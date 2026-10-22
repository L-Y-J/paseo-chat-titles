import { readdir, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { TitleSettings } from "../shared/settings";
import { command, titleArguments, TITLE_INSTRUCTIONS } from "./process";
import { parseTitle, validateTitle } from "./policy";
import { resolveExecutable } from "./runtime";

// Disable discovered local skills for this invocation only; never edit their config.
export async function skillDirectories(roots: string[]): Promise<string[]> {
  const found = new Set<string>(), visited = new Set<string>();
  async function walk(path: string, depth: number) {
    if (depth > 6 || visited.size > 1000) return;
    let resolved: string, entries;
    try { resolved = await realpath(path); entries = await readdir(path, { withFileTypes: true }); }
    catch { return; }
    if (entries.some(entry => entry.name === "SKILL.md")) { found.add(path); found.add(resolved); }
    if (visited.has(resolved)) return;
    visited.add(resolved);
    for (const entry of entries) if (entry.isDirectory() || entry.isSymbolicLink()) await walk(join(path, entry.name), depth + 1);
  }
  for (const root of roots) await walk(root, 0);
  return [...found].sort();
}

export function codexArguments(model: string, instructions: string, skills: string[]): string[] {
  const overrides = [
    'model_reasoning_effort="low"', 'web_search="disabled"', 'project_doc_max_bytes=0',
    `model_instructions_file=${JSON.stringify(instructions)}`,
    ...["shell_tool", "apps", "plugins", "memories", "multi_agent", "image_generation", "view_image", "hooks"].map(feature => `features.${feature}=false`),
    // Installed Codex 0.162.1 matches the SKILL.md path, rather than its folder.
    `skills.config=[${skills.map(path => `{path=${JSON.stringify(join(path, "SKILL.md"))},enabled=false}`).join(",")}]`,
  ];
  return ["exec", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--skip-git-repo-check",
    "--json", "-s", "read-only", "-m", model, ...overrides.flatMap(value => ["-c", value]), "-"];
}

export function parseCodexTitle(output: string): string {
  let title: string | undefined;
  for (const line of output.trim().split("\n")) {
    const event = JSON.parse(line);
    if (event.type === "turn.failed" || event.type === "error") throw new Error("Codex naming failed");
    if (event.type === "item.completed" && event.item?.type === "agent_message") title = event.item.text;
    if (event.type === "item.completed" && /command_execution|mcp_tool_call|collab_tool_call/.test(event.item?.type ?? "")) throw new Error("Unexpected title tool call");
  }
  if (!title) throw new Error("No title returned");
  return validateTitle(JSON.parse(title).title);
}

export async function generateTitle(settings: TitleSettings, prompt: string, cwd: string, signal: AbortSignal): Promise<string> {
  if (settings.provider === "claude") {
    return parseTitle(await command(await resolveExecutable("claude"), titleArguments(settings.claudeModel), {
      cwd, signal, input: JSON.stringify({ userRequests: prompt }),
    }));
  }
  const instructions = join(cwd, "title-instructions.txt");
  await writeFile(instructions, TITLE_INSTRUCTIONS, { mode: 0o600 });
  const home = process.env.CODEX_HOME || join(homedir(), ".codex");
  const skills = await skillDirectories([join(homedir(), ".agents/skills"), join(home, "skills")]);
  return parseCodexTitle(await command(await resolveExecutable("codex"), codexArguments(settings.codexModel, instructions, skills), {
    cwd, signal, input: JSON.stringify({ userRequests: prompt }),
  }));
}
