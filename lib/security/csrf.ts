import type { Env } from "@/lib/env";

export type CsrfVerdict =
  { ok: true } | { ok: false; reason: "missing_origin" | "origin_mismatch" | "cross_site" };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Accepts safe methods and mutations whose Fetch Metadata or Origin header proves same-origin. */
export function isSameOriginMutation(req: Request, allowedOrigin: string): CsrfVerdict {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return { ok: true };
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return { ok: true };
  const origin = req.headers.get("origin");
  if (origin === allowedOrigin) return { ok: true };
  if (site) return { ok: false, reason: "cross_site" };
  return { ok: false, reason: origin ? "origin_mismatch" : "missing_origin" };
}

/** Origin the browser must report: the configured app origin when hosted, the request host over http when local. */
export function allowedOriginFor(req: Request, e: Pick<Env, "APP_URL" | "APP_MODE">): string {
  if (e.APP_MODE === "hosted" && e.APP_URL) return new URL(e.APP_URL).origin;
  return `http://${req.headers.get("host") ?? new URL(req.url).host}`;
}
