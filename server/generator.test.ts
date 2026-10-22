import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexArguments, parseCodexTitle, skillDirectories } from "./generator";
import { preferences } from "../shared/settings";
import { titleArguments } from "./process";

test("defaults to ChatGPT Luna; provider/model values are validated", () => {
  assert.deepEqual(preferences.schema.parse({}), { provider: "codex", codexModel: "gpt-6-luna", claudeModel: "haiku" });
  assert.equal(preferences.schema.safeParse({ provider: "other" }).success, false);
  assert.equal(preferences.schema.safeParse({ codexModel: "--dangerous-option" }).success, false);
  assert.equal(preferences.schema.safeParse({ codexModel: "gpt-5.6-luna" }).success, true);
  assert.equal(titleArguments("sonnet")[2], "sonnet");
});
test("Codex naming is ephemeral, read-only and excludes normal config and tools", () => {
  const args = codexArguments("gpt-6-luna", "/private/prompt.txt", ["/private/skills/name"]);
  for (const flag of ["--ephemeral", "--ignore-user-config", "--ignore-rules"]) assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf("-s") + 1], "read-only");
  assert.equal(args[args.indexOf("-m") + 1], "gpt-6-luna");
  for (const override of ["features.shell_tool=false", "features.apps=false", "features.plugins=false", "features.hooks=false", "features.view_image=false"]) assert.ok(args.includes(override));
  assert.ok(args.some(arg => arg.startsWith("skills.config=[") && arg.includes("enabled=false")));
});
test("parses Codex JSONL and rejects missing/failed/tool-using results", () => {
  const output = [{ type: "thread.started" }, { type: "item.completed", item: { type: "agent_message", text: '{"title":"Debug staging Redis timeouts"}' } }, { type: "turn.completed" }].map(x => JSON.stringify(x)).join("\n");
  assert.equal(parseCodexTitle(output), "Debug staging Redis timeouts");
  assert.throws(() => parseCodexTitle('{"type":"turn.failed"}'));
  assert.throws(() => parseCodexTitle('{"type":"turn.completed"}'));
  assert.throws(() => parseCodexTitle('{"type":"item.completed","item":{"type":"mcp_tool_call"}}'));
});
test("skill scan handles symlinks and loops without reading instructions", async () => {
  const root = await mkdtemp(join(tmpdir(), "title-skills-"));
  try {
    await mkdir(join(root, "actual"));
    await writeFile(join(root, "actual/SKILL.md"), "private instructions");
    await symlink(join(root, "actual"), join(root, "alias"));
    await symlink(root, join(root, "actual/loop"));
    const found = await skillDirectories([root, join(root, "missing")]);
    assert.ok(found.includes(join(root, "actual")));
    assert.ok(found.length <= 4);
  } finally { await rm(root, { recursive: true }); }
});
