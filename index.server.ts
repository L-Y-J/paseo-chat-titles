import type { PluginServerContext } from "@getpaseo/plugin/server";
import { registerTitles } from "./server/titles";
import { preferences } from "./shared/settings";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  return registerTitles(server, async () => {
    const current = await settings.read();
    return current.status === "ready" ? current.values : null;
  });
}
