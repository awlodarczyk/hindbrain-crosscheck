import { uniqueCitations } from "./types";
import type { Citation } from "./types";

const URL_RE = /https?:\/\/[^\s<>"'`]+/g;

/** Extracts unique http(s) URLs from free text, stripping trailing punctuation. */
export function extractUrls(text: string): readonly Citation[] {
  const found = (text.match(URL_RE) ?? []).flatMap((m) => {
    const url = m.replace(/[.,;:!?)\]}]+$/, "");
    try {
      return [{ title: new URL(url).hostname, url }];
    } catch {
      return [];
    }
  });
  return uniqueCitations(found);
}
