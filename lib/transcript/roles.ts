/** Speaker of a transcript turn. */
export type TurnRole = "user" | "assistant";

/** Display and export label for each turn role. */
export const ROLE_LABEL: Record<TurnRole, string> = { user: "User", assistant: "Assistant" };
