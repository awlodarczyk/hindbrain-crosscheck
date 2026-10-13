import { isIP } from "node:net";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BROWSER_ID = /^[A-Za-z0-9_-]{16,128}$/;

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
    if (last && isIP(last)) return last;
  }
  if (opts.socketIp) return opts.socketIp;
  if (opts.local && LOOPBACK_HOSTS.has(new URL(req.url).hostname)) {
    return "127.0.0.1";
  }
  return "unknown";
}

/** Raw `hc_bid` cookie value when well-formed; signature checking is not done here. */
export function browserIdFromCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (name === "hc_bid") return BROWSER_ID.test(value) ? value : null;
  }
  return null;
}
