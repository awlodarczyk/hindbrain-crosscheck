import { ROLE_LABEL, type TurnRole } from "./roles";

export type ViewTurn = { readonly role: TurnRole | "other"; readonly text: string };

const LABEL_ROLE: Record<string, TurnRole> = {
  [ROLE_LABEL.user.toLowerCase()]: "user",
  [ROLE_LABEL.assistant.toLowerCase()]: "assistant",
  human: "user",
  ai: "assistant",
};

const LABEL_LINE = new RegExp(`^\\s*(${Object.keys(LABEL_ROLE).join("|")})\\s*:`, "i");

/**
 * Splits transcript text into turns at lines starting with a role label
 * (`User:`, `Assistant:`, `Human:`, `AI:`; case-insensitive). Text before the first
 * label, or text with no labels, becomes an `other` turn. Bodies are trimmed and empty turns dropped.
 */
export function splitTurns(text: string): readonly ViewTurn[] {
  const turns: { role: ViewTurn["role"]; lines: string[] }[] = [{ role: "other", lines: [] }];
  for (const line of text.split("\n")) {
    const match = LABEL_LINE.exec(line);
    const role = match ? LABEL_ROLE[match[1]!.toLowerCase()] : undefined;
    if (match && role) turns.push({ role, lines: [line.slice(match[0].length)] });
    else turns[turns.length - 1]!.lines.push(line);
  }
  return turns
    .map((t) => ({ role: t.role, text: t.lines.join("\n").trim() }))
    .filter((t) => t.text !== "");
}
