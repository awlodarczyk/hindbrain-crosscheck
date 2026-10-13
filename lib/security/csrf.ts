import type { Env } from "@/lib/env";

export type CsrfVerdict =
  { ok: true } | { ok: false; reason: "missing_origin" | "origin_mismatch" | "cross_site" };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Accepts safe methods and mutations whose Fetch Metadata or Origin header proves same-origin. */
export function isSameOriginMutation(req: Request, allowedOrigin: string): CsrfVerdict {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return { ok: true };
  const site = req.headers.get("sec-fetch-site");
  // "none" marks a user-initiated navigation (address bar, bookmark), which is allowed on POST.
  if (site === "same-origin" || site === "none") return { ok: true };
  const origin = req.headers.get("origin");
  if (origin === allowedOrigin) return { ok: true };
  if (site) return { ok: false, reason: "cross_site" };
  return { ok: false, reason: origin ? "origin_mismatch" : "missing_origin" };
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** Not a valid Origin header value, so no request can match it. */
export const DENIED_ORIGIN = "denied:";

/**
 * Origin the browser must report: the configured app origin when hosted; when local, the request host
 * over http if its hostname is loopback, otherwise {@link DENIED_ORIGIN}.
 */
export function allowedOriginFor(req: Request, e: Pick<Env, "APP_URL" | "APP_MODE">): string {
  if (e.APP_MODE === "hosted" && e.APP_URL) return new URL(e.APP_URL).origin;
  const host = req.headers.get("host") ?? new URL(req.url).host;
  try {
    return LOCAL_HOSTNAMES.has(new URL(`http://${host}`).hostname)
      ? `http://${host}`
      : DENIED_ORIGIN;
  } catch {
    return DENIED_ORIGIN;
  }
}
