import { z } from "zod";

export type Turn = { readonly role: "user" | "assistant"; readonly text: string };

const ChatGptNode = z
  .object({
    parent: z.string().nullish(),
    children: z.array(z.string()).default([]),
    message: z
      .object({
        author: z.object({ role: z.string() }).passthrough(),
        content: z
          .object({ content_type: z.string(), parts: z.array(z.unknown()).default([]) })
          .passthrough(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();
const ChatGptConversation = z
  .object({ mapping: z.record(ChatGptNode), current_node: z.string().nullish() })
  .passthrough();

const ClaudeMessage = z
  .object({
    sender: z.string(),
    text: z.string().nullish(),
    content: z
      .array(z.object({ type: z.string(), text: z.string().nullish() }).passthrough())
      .nullish(),
  })
  .passthrough();
const ClaudeConversation = z.object({ chat_messages: z.array(ClaudeMessage) }).passthrough();

type MappingNodes = z.infer<typeof ChatGptConversation>["mapping"];

function firstConversation(json: unknown): unknown {
  return Array.isArray(json) ? json[0] : json;
}

const ROLE_LABEL: Record<Turn["role"], string> = { user: "User", assistant: "Assistant" };
const CLAUDE_SENDER_ROLE: Record<string, Turn["role"] | undefined> = {
  human: "user",
  assistant: "assistant",
};

function nodeAt(mapping: MappingNodes, id: string): MappingNodes[string] | undefined {
  return Object.hasOwn(mapping, id) ? mapping[id] : undefined;
}

function pathToRoot(mapping: MappingNodes, endId: string): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (let id: string | null | undefined = endId; id && nodeAt(mapping, id) && !seen.has(id);) {
    seen.add(id);
    ids.push(id);
    id = nodeAt(mapping, id)?.parent;
  }
  return ids.reverse();
}

function deepestLeaf(mapping: MappingNodes): string | null {
  const leaves = Object.keys(mapping).filter((id) => mapping[id]?.children.length === 0);
  const depth = (id: string) => pathToRoot(mapping, id).length;
  return leaves.reduce<string | null>(
    (best, id) => (best === null || depth(id) > depth(best) ? id : best),
    null,
  );
}

function nodeToTurn(node: MappingNodes[string] | undefined): Turn | null {
  const message = node?.message;
  const role = message?.author.role;
  if ((role !== "user" && role !== "assistant") || message?.content.content_type !== "text") {
    return null;
  }
  const text = message.content.parts
    .filter((p): p is string => typeof p === "string")
    .join("\n")
    .trim();
  return text === "" ? null : { role, text };
}

/** Linear user/assistant turns of a ChatGPT export (array or single conversation), or `null` if the shape does not match. */
export function parseChatGptExport(json: unknown): Turn[] | null {
  const parsed = ChatGptConversation.safeParse(firstConversation(json));
  if (!parsed.success) return null;
  const { mapping, current_node } = parsed.data;
  const end = current_node && nodeAt(mapping, current_node) ? current_node : deepestLeaf(mapping);
  if (!end) return null;
  const turns = pathToRoot(mapping, end).flatMap((id) => nodeToTurn(mapping[id]) ?? []);
  return turns.length > 0 ? turns : null;
}

/** User/assistant turns of a Claude export (array or single conversation), or `null` if the shape does not match. */
export function parseClaudeExport(json: unknown): Turn[] | null {
  const parsed = ClaudeConversation.safeParse(firstConversation(json));
  if (!parsed.success) return null;
  const turns = parsed.data.chat_messages.flatMap((m): Turn[] => {
    const role = CLAUDE_SENDER_ROLE[m.sender];
    if (!role) return [];
    const joined = (m.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    const text = (m.text?.trim() ? m.text : joined).trim();
    return text === "" ? [] : [{ role, text }];
  });
  return turns.length > 0 ? turns : null;
}

/** Renders turns as `User: …` / `Assistant: …` blocks separated by one blank line. */
export function formatTurns(turns: readonly Turn[]): string {
  return turns.map((t) => `${ROLE_LABEL[t.role]}: ${t.text}`).join("\n\n");
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Converts a ChatGPT or Claude export JSON string into plain turns; any other input is returned unchanged. */
export function normalizeTranscript(raw: string): string {
  if (!/^\s*[{[]/.test(raw)) return raw;
  const json = tryParseJson(raw);
  if (json === undefined) return raw;
  const turns = parseChatGptExport(json) ?? parseClaudeExport(json);
  return turns ? formatTurns(turns) : raw;
}
