import type { PluginClientContext } from "@getpaseo/plugin/client";
import { TitleSettingsScreen } from "./client/settings";

export default function contribute(client: PluginClientContext) {
  return client.addSettingsScreen({ id: "generation", title: "Chat Titles", icon: "Type", Component: TitleSettingsScreen });
}
