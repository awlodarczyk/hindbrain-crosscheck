import { isIP } from "node:net";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAPPED_V4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** Rewrites IPv4-mapped IPv6 (`::ffff:a.b.c.d`) to plain IPv4. */
const normalizeIp = (ip: string): string => MAPPED_V4.exec(ip)?.[1] ?? ip;

/**
 * Resolves the caller address.
 * - `trustProxy`: the last `x-forwarded-for` hop (the reverse proxy appends the client last), if it is an IP literal. `x-real-ip` is never read.
 * - Otherwise `socketIp`, or `"127.0.0.1"` when `local` and the request host is loopback (route handlers do not expose the socket), else `"unknown"`.
 */
export function clientIp(
  req: Request,
  opts: { trustProxy: boolean; socketIp?: string | null; local?: boolean },
): string {
  if (opts.trustProxy) {
    const last = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (last && isIP(last)) return normalizeIp(last);
  }
  if (opts.socketIp) return normalizeIp(opts.socketIp);
  if (opts.local && LOOPBACK_HOSTS.has(new URL(req.url).hostname)) {
    return "127.0.0.1";
  }
  return "unknown";
}
