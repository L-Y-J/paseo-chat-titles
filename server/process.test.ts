import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { command } from "./process";

test("commands use stdin without shell interpretation", async () => {
  const input = "$(touch /should-never-exist) `echo not-a-command`";
  const output = await command(process.execPath, ["-e", "process.stdin.pipe(process.stdout)"], {
    cwd: tmpdir(), signal: new AbortController().signal, input,
  });
  assert.equal(output, input);
});
test("timeout kills hung helpers", async () => {
  await assert.rejects(command(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    cwd: tmpdir(), signal: new AbortController().signal, timeoutMs: 100,
  }), /failed/);
});
test("timeout keeps output the helper already printed", async () => {
  // /bin/sh writes at once; `node -e` can take ~900ms just to boot here.
  const output = await command("/bin/sh", ["-c", "printf '{\"title\":\"ok\"}'; exec sleep 30"], {
    cwd: tmpdir(), signal: new AbortController().signal, timeoutMs: 300,
  });
  assert.equal(output, '{"title":"ok"}');
});
test("cleanup abort cancels active helpers", async () => {
  const abort = new AbortController();
  const result = command(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    cwd: tmpdir(), signal: abort.signal,
  });
  abort.abort();
  await assert.rejects(result, /failed/);
});
test("rejects excessive output", async () => {
  await assert.rejects(command(process.execPath, ["-e", "process.stdout.write('x'.repeat(100000))"], {
    cwd: tmpdir(), signal: new AbortController().signal,
  }), /failed/);
});
