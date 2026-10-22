export type TitleState = { title?: string; protected?: boolean; attempts?: number };
export type Message = { type: string; text?: string };

export function firstLine(text: string): string {
  return (text.split(/\r?\n/).find(line => line.trim()) ?? "").trim().replace(/\s+/g, " ").slice(0, 60).trim();
}

export function automaticTitle(title: string | null | undefined, firstPrompt: string): boolean {
  return !title?.trim() || /^(new (agent|chat|conversation)|untitled)$/i.test(title.trim()) || title === firstLine(firstPrompt);
}

export function meaningful(text: string): boolean {
  const normalized = text.trim().replace(/[!?.]+$/g, "").toLowerCase();
  if (/^(hey|hi|hello|yo|sup|hey there|hello there|thanks|thank you|ok|okay|done|continue|yes|no|test|ping)$/.test(normalized)) return false;
  return normalized.length >= 16 && normalized.split(/\s+/).length >= 3;
}

export function promptForTitle(messages: Message[]): string | null {
  const requests = messages.filter(item => item.type === "user_message" && meaningful(item.text ?? ""));
  if (!requests.length) return null;
  // Titles need the task, never tool output, files, reasoning, or assistant instructions.
  return requests.slice(0, 3).map(item => (item.text ?? "")
    .replace(/-----BEGIN [\s\S]*?-----END [^-]+-----/g, "[redacted key]")
    .replace(/\b(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]+/g, "[redacted token]")
    .replace(/([?&](?:code|token|key|secret|state)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 1200)).join("\n\n");
}

export function eligible(state: TitleState | undefined, current: string | null | undefined, firstPrompt: string): boolean {
  if (state?.protected || state?.title || (state?.attempts ?? 0) >= 3) return false;
  return automaticTitle(current, firstPrompt);
}

export function parseTitle(output: string): string {
  const envelope = JSON.parse(output);
  if (envelope.is_error) throw new Error("Title model failed");
  const body = envelope.structured_output ?? JSON.parse(envelope.result);
  return validateTitle(body.title);
}

export function validateTitle(title: unknown): string {
  if (typeof title !== "string" || title.trim().length < 5 || title.length > 72 || /[\r\n<>]/.test(title) || /^(new chat|untitled|chat title)$/i.test(title.trim())) {
    throw new Error("Invalid title output");
  }
  return title.trim();
}
