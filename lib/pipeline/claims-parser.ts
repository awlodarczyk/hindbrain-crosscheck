import { z } from "zod";
import { VERDICTS, type Verdict } from "@/lib/db/enums";

export type ParsedClaim = {
  claim: string;
  verdict: Verdict;
  note: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
};
export type ParsedReview = {
  overall: string | null;
  claims: readonly ParsedClaim[];
  parseStatus: "json" | "fallback";
  warnings: readonly string[];
};

export const MAX_CLAIMS = 50;
const MAX_CLAIM_CHARS = 500;
const FENCE = "```";

const reviewSchema = z.object({
  overall: z.string().nullish(),
  claims: z.array(
    z.object({
      claim: z.string().trim().min(3),
      verdict: z.string(),
      note: z.string().nullish(),
      source: z.object({ title: z.string().nullish(), url: z.string() }).nullish(),
    }),
  ),
});

function lastFencedBlock(text: string): string | null {
  const parts = text.split(FENCE);
  for (let i = parts.length - 2; i >= 1; i -= 2) {
    const part = parts[i] ?? "";
    const nl = part.indexOf("\n");
    const lang = (nl < 0 ? "" : part.slice(0, nl)).trim().toLowerCase();
    const body = (nl < 0 ? part : part.slice(nl + 1)).trim();
    if (lang === "json" || (lang === "" && body.startsWith("{"))) return body;
  }
  return null;
}

function lastBareObject(text: string): string | null {
  const end = text.lastIndexOf("}");
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    if (text[i] === "}") depth++;
    else if (text[i] === "{" && --depth === 0) return text.slice(i, end + 1);
  }
  return null;
}

export function extractJsonBlock(text: string): string | null {
  return lastFencedBlock(text) ?? lastBareObject(text);
}

export function repairJson(src: string): string {
  return src
    .replace(/^﻿/, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function fallback(text: string, warning: string): ParsedReview {
  const trimmed = text.trim();
  return {
    overall: null,
    claims: [
      {
        claim: trimmed ? trimmed.slice(0, 200) : "Reviewer returned no text.",
        verdict: "unverifiable",
        note: "Reviewer returned prose; see Raw.",
        sourceUrl: null,
        sourceTitle: null,
      },
    ],
    parseStatus: "fallback",
    warnings: [warning],
  };
}

function isHttpUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

type RawClaim = z.infer<typeof reviewSchema>["claims"][number];

function normalizeClaim(
  raw: RawClaim,
  idx: number,
  requireSource: boolean,
): { claim: ParsedClaim; warnings: string[] } {
  const warnings: string[] = [];
  let verdict = VERDICTS.find((v) => v === raw.verdict) ?? "unverifiable";
  if (verdict === "unverifiable" && raw.verdict !== "unverifiable")
    warnings.push(`invalid_verdict:${idx}`);
  let source = raw.source ?? null;
  if (source && !isHttpUrl(source.url)) {
    warnings.push(`invalid_source_url:${idx}`);
    source = null;
  }
  let note = raw.note?.trim() || null;
  if (requireSource && !source) {
    verdict = "unverifiable";
    note = `No source given. ${note ?? ""}`.trim();
  }
  const text =
    raw.claim.length > MAX_CLAIM_CHARS ? `${raw.claim.slice(0, MAX_CLAIM_CHARS)}…` : raw.claim;
  return {
    claim: {
      claim: text,
      verdict,
      note,
      sourceUrl: source?.url ?? null,
      sourceTitle: source?.title ?? null,
    },
    warnings,
  };
}

export function parseReview(text: string, opts: { requireSourcePerClaim: boolean }): ParsedReview {
  const block = extractJsonBlock(text);
  if (block === null) return fallback(text, "no_json_block");
  let json: unknown;
  try {
    json = JSON.parse(repairJson(block));
  } catch {
    return fallback(text, "json_parse_failed");
  }
  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success) return fallback(text, "json_shape_invalid");

  const warnings: string[] = [];
  const claims: ParsedClaim[] = [];
  const seen = new Set<string>();
  parsed.data.claims.forEach((raw, idx) => {
    const key = raw.claim.toLowerCase();
    if (seen.has(key)) return void warnings.push(`duplicate_claim:${idx}`);
    if (claims.length >= MAX_CLAIMS) {
      if (!warnings.includes("too_many_claims")) warnings.push("too_many_claims");
      return;
    }
    seen.add(key);
    const n = normalizeClaim(raw, idx, opts.requireSourcePerClaim);
    warnings.push(...n.warnings);
    claims.push(n.claim);
  });
  return { overall: parsed.data.overall?.trim() || null, claims, parseStatus: "json", warnings };
}
