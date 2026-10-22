import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const preferences = defineSettings({
  id: "generation", scope: "host", version: 1,
  schema: z.object({
    provider: z.enum(["codex", "claude"]).default("codex"),
    codexModel: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/).default("gpt-6-luna"),
    claudeModel: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/).default("haiku"),
  }),
});
export type TitleSettings = z.output<typeof preferences.schema>;
