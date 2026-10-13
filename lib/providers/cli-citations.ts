import { uniqueCitations } from "./types";
import type { Citation } from "./types";

const TRAILING_PUNCT = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}"]);
const URL_RE = /https?:\/\/[^\s<>"'`]{1,2040}/g;

/** Extracts unique http(s) URLs from free text, stripping trailing punctuation. */
export function extractUrls(text: string): readonly Citation[] {
  const found = (text.match(URL_RE) ?? []).flatMap((m) => {
    let end = m.length;
    while (end > 0 && TRAILING_PUNCT.has(m.charAt(end - 1))) end--;
    const url = m.slice(0, end);
    try {
      return [{ title: new URL(url).hostname, url }];
    } catch {
      return [];
    }
  });
  return uniqueCitations(found);
}
