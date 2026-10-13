import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export const MAX_MARKDOWN_CHARS = 200_000;

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "del",
    "br",
    "strong",
    "em",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "a",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
  ],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    h1: "h3",
    h2: "h3",
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener nofollow", target: "_blank" }),
  },
};

/** Cuts `s` to at most `max` UTF-16 units without splitting a surrogate pair. */
function truncate(s: string, max: number): string {
  const last = s.charCodeAt(max - 1);
  const splitsPair = last >= 0xd800 && last <= 0xdbff;
  return s.slice(0, splitsPair ? max - 1 : max);
}

/**
 * Renders untrusted model Markdown (GFM) to sanitized HTML; the only HTML that may be stored or
 * rendered for answers. Input beyond {@link MAX_MARKDOWN_CHARS} is truncated with "…".
 */
export function renderMarkdown(md: string): string {
  if (!md) return "";
  const input = md.length > MAX_MARKDOWN_CHARS ? `${truncate(md, MAX_MARKDOWN_CHARS)}…` : md;
  const html = marked.parse(input, { async: false, gfm: true });
  return sanitizeHtml(html, SANITIZE).trim();
}
