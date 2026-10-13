export type TokenName =
  | "bg/page"
  | "bg/subtle"
  | "bg/card"
  | "bg/muted"
  | "bg/selected"
  | "bg/disputed"
  | "text/primary"
  | "text/secondary"
  | "text/muted"
  | "border/default"
  | "border/strong"
  | "accent/default"
  | "accent/on"
  | "status/supported"
  | "status/disputed"
  | "status/unverifiable"
  | "status/running"
  | "model/claude"
  | "model/chatgpt";

export type Token = { name: TokenName; css: string; light: string; dark: string };

const row = (name: TokenName, light: string, dark: string): Token => ({
  name,
  css: "--" + name.replace("/", "-"),
  light,
  dark,
});

export const TOKENS: readonly Token[] = [
  row("bg/page", "#FFFFFF", "#09090B"),
  row("bg/subtle", "#FAFAFA", "#0F0F11"),
  row("bg/card", "#FFFFFF", "#18181B"),
  row("bg/muted", "#F4F4F5", "#27272A"),
  row("bg/selected", "#EEF2FF", "#1E1B4B"),
  row("bg/disputed", "#FEF2F2", "#2A1414"),
  row("text/primary", "#09090B", "#FAFAFA"),
  row("text/secondary", "#71717A", "#A1A1AA"),
  row("text/muted", "#A1A1AA", "#71717A"),
  row("border/default", "#E4E4E7", "#27272A"),
  row("border/strong", "#D4D4D8", "#3F3F46"),
  row("accent/default", "#4F46E5", "#818CF8"),
  row("accent/on", "#FFFFFF", "#09090B"),
  row("status/supported", "#16A34A", "#4ADE80"),
  row("status/disputed", "#DC2626", "#F87171"),
  row("status/unverifiable", "#D97706", "#FBBF24"),
  row("status/running", "#71717A", "#A1A1AA"),
  row("model/claude", "#B4552D", "#D97757"),
  row("model/chatgpt", "#2F5F8A", "#6AA0D1"),
];

/** Renders one `--name: #HEX;` line per token for the given mode. */
export function tokensToCss(mode: "light" | "dark"): string {
  return TOKENS.map((t) => `${t.css}: ${t[mode]};`).join("\n");
}
