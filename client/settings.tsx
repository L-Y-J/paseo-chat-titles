import { useState } from "react";
import { Text, View } from "react-native";
import { useSettings, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { SettingsAction, SettingsCard, SettingsInput, SettingsSection, SettingsSelect } from "@getpaseo/plugin/client/ui";
import { preferences, type TitleSettings } from "../shared/settings";

export function TitleSettingsScreen({ theme, layout }: PluginSurfaceProps) {
  const settings = useSettings(preferences);
  const color = theme.colors.foreground;
  if (settings.status !== "ready") {
    return <Text style={{ color }}>{settings.status === "loading" ? "Loading title settings…" : "Could not load settings. Reopen this page to retry."}</Text>;
  }
  return <View style={{ gap: layout.compact ? 16 : 24 }}>
    <Text style={{ color: theme.colors.foregroundMuted }}>Choose the subscription and model used only for naming chats. Your working agents and MCPs are not changed.</Text>
    <Editor key={settings.revision} initial={settings.values} saving={settings.saving}
      error={settings.saveError ?? null} onSave={values => settings.save(values, settings.revision)} />
  </View>;
}

function Editor({ initial, saving, error, onSave }: {
  initial: TitleSettings; saving: boolean; error: string | null;
  onSave(values: TitleSettings): Promise<boolean>;
}) {
  const [draft, setDraft] = useState(initial);
  const provider = draft.provider;
  return <SettingsSection title="Title generation">
    <SettingsCard>
      <SettingsSelect label="Provider" value={provider} disabled={saving}
        options={[{ label: "Codex · ChatGPT subscription", value: "codex" }, { label: "Claude · Claude subscription", value: "claude" }]}
        onValueChange={value => setDraft({ ...draft, provider: value })} />
      <SettingsInput key={provider} label="Model" disabled={saving}
        initialValue={provider === "codex" ? draft.codexModel : draft.claudeModel}
        placeholder={provider === "codex" ? "gpt-6-luna" : "haiku"}
        hint={provider === "codex" ? "Recommended: gpt-6-luna. Uses the server’s existing ChatGPT login at low reasoning effort." : "Recommended: haiku. Uses the server’s existing Claude login."}
        onChangeText={value => setDraft(provider === "codex" ? { ...draft, codexModel: value.trim() } : { ...draft, claudeModel: value.trim() })} />
      <SettingsAction label="Apply to future title generation" actionLabel={saving ? "Saving…" : "Save"}
        error={error} disabled={saving || !preferences.schema.safeParse(draft).success}
        hint="Uses the selected subscription’s quota. No API key or cross-provider fallback. Existing titles stay unchanged."
        onPress={() => { void onSave(draft); }} />
    </SettingsCard>
  </SettingsSection>;
}
