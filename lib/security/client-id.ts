import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const BROWSER_ID_COOKIE = "hc_bid";

const MAX_FUTURE_SKEW_MS = 60_000;
const MAX_AGE_SEC = 31_536_000;
const SIG_BYTES = 16;
const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const TS_PATTERN = /^[0-9a-z]{1,12}$/;

const sign = (secret: Buffer, id: string, ts: string): Buffer =>
  createHmac("sha256", secret).update(`${id}.${ts}`).digest().subarray(0, SIG_BYTES);

/** Returns `<id>.<issued-ms base36>.<signature>`; the id is 16 random bytes (base64url). */
export function issueBrowserId(secret: Buffer, now: Date): string {
  const id = randomBytes(16).toString("base64url");
  const ts = now.getTime().toString(36);
  return `${id}.${ts}.${sign(secret, id, ts).toString("base64url")}`;
}

/** Verifies the signature in constant time; returns null when malformed, tampered, or issued more than 60 s in the future. */
export function verifyBrowserId(
  secret: Buffer,
  cookie: string | undefined,
  now: Date,
): { id: string; ageSec: number } | null {
  const parts = cookie?.split(".");
  if (parts?.length !== 3) return null;
  const [id = "", ts = "", sig = ""] = parts;
  if (!ID_PATTERN.test(id) || !TS_PATTERN.test(ts)) return null;
  const given = Buffer.from(sig, "base64url");
  const expected = sign(secret, id, ts);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const ageMs = now.getTime() - parseInt(ts, 36);
  if (ageMs < -MAX_FUTURE_SKEW_MS) return null;
  return { id, ageSec: Math.max(0, Math.floor(ageMs / 1000)) };
}

/** Set-Cookie value for the browser id: one year, HttpOnly, SameSite=Lax, Secure when requested. */
export function browserIdCookieHeader(value: string, opts: { secure: boolean }): string {
  const base = `${BROWSER_ID_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}`;
  return opts.secure ? `${base}; Secure` : base;
}
