import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, chmod, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { paseoHome, resolveExecutable } from "./runtime";

test("honors non-default daemon homes", () => {
  assert.equal(paseoHome({}, "/example/home"), "/example/home/.paseo");
  assert.equal(paseoHome({ PASEO_HOME: "/example/other" }), "/example/other");
  assert.throws(() => paseoHome({ PASEO_HOME: "relative" }), /absolute/);
});
test("discovers executable CLI installations without assuming a user path", async () => {
  const root = await mkdtemp(join(tmpdir(), "title-binaries-"));
  try {
    const bin = join(root, "bin");
    await mkdir(bin);
    await writeFile(join(bin, "codex"), "test fixture");
    await chmod(join(bin, "codex"), 0o700);
    assert.equal(await resolveExecutable("codex", { PATH: `relative${delimiter}${bin}` }, root), join(bin, "codex"));
  } finally { await rm(root, { recursive: true }); }
});
