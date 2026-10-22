import { test } from "node:test";
import assert from "node:assert/strict";
import { automaticTitle, eligible, firstLine, meaningful, parseTitle, promptForTitle } from "./policy";
import { titleArguments } from "./process";

test("recognizes Paseo's automatic first-line titles", () => {
  const prompt = "\n Please investigate the staging API Redis connection failure and retry logic\nOther detail";
  assert.equal(firstLine(prompt), "Please investigate the staging API Redis connection failure");
  assert.equal(automaticTitle(firstLine(prompt), prompt), true);
  assert.equal(automaticTitle(null, prompt), true);
  assert.equal(automaticTitle("My manually chosen title", prompt), false);
  const boundary = "Explain Redis connection troubleshooting for a staging API. This continues";
  assert.equal(automaticTitle("Explain Redis connection troubleshooting for a staging API.", boundary), true);
});
test("greetings wait for the real task", () => {
  for (const text of ["hi", "hey!", "done", "continue", "yo?"]) assert.equal(meaningful(text), false);
  assert.equal(promptForTitle([{ type: "user_message", text: "hey!" }]), null);
  assert.match(promptForTitle([{ type: "user_message", text: "hi" }, { type: "user_message", text: "Fix the staging Redis connection failure" }])!, /Redis/);
});
test("only bounded user requests reach the model", () => {
  const result = promptForTitle([
    { type: "tool_call", text: "SECRET TOOL OUTPUT" },
    { type: "assistant_message", text: "ASSISTANT INSTRUCTIONS" },
    { type: "user_message", text: "Fix API authentication with sk-abcdef12345 and https://example.com?token=secret" },
  ])!;
  assert.doesNotMatch(result, /SECRET|INSTRUCTIONS|abcdef|token=secret/);
  assert.ok(promptForTitle([{ type: "user_message", text: "Fix this problem " + "x".repeat(5000) }])!.length <= 1200);
});
test("manual names and previously generated names are never overwritten", () => {
  assert.equal(eligible(undefined, "Manual name", "Fix an API error"), false);
  assert.equal(eligible({ title: "Generated name" }, "Generated name", "Fix an API error"), false);
  assert.equal(eligible({ protected: true }, null, "Fix an API error"), false);
  assert.equal(eligible({ attempts: 3 }, null, "Fix an API error"), false);
  assert.equal(eligible({ attempts: 2 }, "Fix an API error", "Fix an API error"), true);
});
test("validates both Claude structured and plain JSON output", () => {
  assert.equal(parseTitle(JSON.stringify({ structured_output: { title: "Fix staging Redis connections" } })), "Fix staging Redis connections");
  assert.equal(parseTitle(JSON.stringify({ result: '{"title":"Fix staging Redis connections"}' })), "Fix staging Redis connections");
  for (const title of ["New chat", "x".repeat(73), "Bad\nTitle", "<tag>"]) {
    assert.throws(() => parseTitle(JSON.stringify({ structured_output: { title } })));
  }
  assert.throws(() => parseTitle('{"is_error":true}'));
});
test("title helper cannot load MCPs, skills, project config or tools", () => {
  const args = titleArguments();
  for (const flag of ["--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence"]) assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf("--tools") + 1], "");
  assert.equal(args[args.indexOf("--setting-sources") + 1], "");
  assert.equal(args[args.indexOf("--mcp-config") + 1], '{"mcpServers":{}}');
});
