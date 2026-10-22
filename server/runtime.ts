import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join, resolve } from "node:path";

export function paseoHome(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const configured = env.PASEO_HOME?.trim();
  if (configured && !isAbsolute(configured)) throw new Error("PASEO_HOME must be absolute");
  return configured || join(home, ".paseo");
}

export async function resolveExecutable(name: "paseo" | "codex" | "claude", env: NodeJS.ProcessEnv = process.env, home = homedir()): Promise<string> {
  // Ignore relative PATH entries: never launch a helper from a project directory.
  const directories = [...(env.PATH ?? "").split(delimiter).filter(isAbsolute), join(home, ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
  for (const directory of new Set(directories)) {
    const candidate = resolve(directory, name);
    try { await access(candidate, constants.X_OK); return candidate; } catch { /* Try the next installation. */ }
  }
  throw new Error(`Install ${name} and make it available on the daemon PATH`);
}
