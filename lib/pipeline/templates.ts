import type { Settings } from "@/lib/settings/schema";

export const CLAIMS_JSON_SPEC: string = [
  "Return your review in two parts. First, two or three sentences of overall assessment.",
  "Then a fenced JSON block, and nothing after it:",
  "",
  "```json",
  "{",
  '  "overall": "<one-sentence verdict>",',
  '  "claims": [',
  "    {",
  '      "claim": "<the claim, quoted or closely paraphrased>",',
  '      "verdict": "supported" | "disputed" | "partial" | "unverifiable",',
  '      "note": "<one or two sentences: what the sources say, or why it cannot be verified>",',
  '      "source": { "title": "<source name>", "url": "<https://...>" } | null',
  "    }",
  "  ]",
  "}",
  "```",
  "",
  "Rules for the JSON: use exactly those four verdict strings; " +
    '"partial" means true with an important caveat; ' +
    "include at most 20 claims, the most consequential first; " +
    '"source" is null when you found none.',
].join("\n");

export const INSTRUCTIONS_TEMPLATE =
  "Prefer meta-analyses and primary sources over news. State uncertainty explicitly. " +
  "Give numbers with units and years. " +
  "Keep the answer under 250 words unless the question needs more.";

export const STYLE_LINE: Record<Settings["tuning"]["answerStyle"], string> = {
  concise:
    "Keep the answer short: about 120 words, a one-line takeaway first, " +
    "then at most three bullet points.",
  balanced:
    "Lead with a one-line takeaway, then a short explanation " +
    "and three to five bullet points with the key evidence.",
  thorough:
    "Lead with a one-line takeaway, then a structured explanation " +
    "with sections, evidence for and against, and limitations.",
};

export const STRICTNESS_LINE: Record<Settings["verification"]["strictness"], string> = {
  lenient:
    "Accept well-established facts without a source; " +
    "flag only claims that are likely wrong or misleading.",
  standard:
    "Each specific claim should be supported by a source; " +
    "widely known background facts may pass without one.",
  strict:
    "Every number, date, named study and causal claim needs a source; " +
    "if you cannot find one, mark the claim unverifiable.",
};

export const DEPTH_LINE: Record<Settings["tuning"]["webSearchDepth"], string> = {
  quick: "Use at most a couple of searches; prefer the first authoritative result.",
  standard: "Search enough to confirm the key claims from at least two independent sources.",
  deep: "Search thoroughly: look for primary sources, check for newer evidence and conflicting findings.",
};
