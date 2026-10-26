import type { PluginServerContext } from "@getpaseo/plugin/server";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { automaticTitle, eligible, promptForTitle, type TitleState } from "./policy";
import { command } from "./process";
import { generateTitle } from "./generator";
import type { TitleSettings } from "../shared/settings";
import { paseoHome, resolveExecutable } from "./runtime";

export function registerTitles(server: PluginServerContext, readSettings: () => Promise<TitleSettings | null>) {
  const home = paseoHome();
  const directory = join(home, "chat-titles");
  const stateFile = join(directory, "state.json");
  const scratch = join(directory, "empty");
  let states: Record<string, TitleState> = {};
  let healthy = true;
  const ready = (async () => {
    await mkdir(scratch, { recursive: true, mode: 0o700 });
    try {
      const saved = JSON.parse(await readFile(stateFile, "utf8"));
      if (!saved || Array.isArray(saved) || typeof saved !== "object") throw new Error("Invalid title state");
      states = saved;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  })().catch(() => {
    healthy = false;
    console.warn("[chat-titles] state unavailable; auto-naming disabled to preserve existing titles");
  });
  let writes = Promise.resolve();
  const save = () => {
    writes = writes.catch(() => {}).then(async () => {
      await writeFile(`${stateFile}.tmp`, JSON.stringify(states), { mode: 0o600 });
      await rename(`${stateFile}.tmp`, stateFile);
    });
    return writes;
  };
  const running = new Map<string, AbortController>();
  const hook = server.on("agent.turn_ended", async (event, context) => {
    if (event.outcome.kind !== "completed" || event.agent.parentAgentId || running.has(event.agent.id) || running.size >= 2) return;
    const abort = new AbortController();
    running.set(event.agent.id, abort);
    const cancel = () => abort.abort();
    context.signal.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, 66000);
    try {
      await ready;
      if (abort.signal.aborted || !healthy) return;
      if (states[event.agent.id]?.title || states[event.agent.id]?.protected) return;
      const agent = context.paseo.agents.ref(event.agent.id);
      let page = await agent.timeline.refetch({ direction: "tail", limit: 40 });
      if (page.error || page.gap || page.staleCursor) return;
      if (page.hasOlder) {
        page = await agent.timeline.refetch({ direction: "before", limit: 40,
          cursor: { epoch: page.epoch, seq: page.window.minSeq + 40 } });
        if (page.error || page.gap || page.staleCursor || page.hasOlder) return;
      }
      const messages = page.entries.map(entry => entry.item);
      const firstPrompt = messages.find(item => item.type === "user_message")?.text;
      if (!firstPrompt) return;
      const current = agent.current();
      if (!current || current.archivedAt) return;
      if (!automaticTitle(current.title, firstPrompt)) {
        states[event.agent.id] = { protected: true }; await save(); return;
      }
      const prompt = promptForTitle(messages);
      if (!prompt || !eligible(states[event.agent.id], current.title, firstPrompt)) return;
      const previous = current.title;
      states[event.agent.id] = { attempts: (states[event.agent.id]?.attempts ?? 0) + 1 };
      await save();
      const settings = await readSettings();
      if (!settings) return;
      const title = await generateTitle(settings, prompt, scratch, abort.signal);
      await agent.refresh();
      if (abort.signal.aborted || agent.current()?.archivedAt) return;
      if (agent.current()?.title !== previous) {
        states[event.agent.id] = { protected: true }; await save(); return;
      }
      // 0.12's public SDK lacks agent title updates; use its supported CLI.
      await command(await resolveExecutable("paseo"), ["agent", "update", event.agent.id,
        "--name", title, "--home", home, "--json"],
      { cwd: scratch, signal: abort.signal, timeoutMs: 5000 });
      states[event.agent.id] = { title };
      await save();
      console.info(`[chat-titles] named ${event.agent.id}`);
    } catch {
      console.warn(`[chat-titles] naming skipped for ${event.agent.id}; existing title retained`);
    } finally {
      clearTimeout(timer);
      context.signal.removeEventListener("abort", cancel);
      running.delete(event.agent.id);
    }
  });
  console.info("[chat-titles] enabled: configurable provider/model, manual names preserved, isolated title helper");
  return async () => {
    hook();
    for (const abort of running.values()) abort.abort();
    await writes.catch(() => {});
  };
}
