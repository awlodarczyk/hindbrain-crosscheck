import { isIP } from "node:net";
import { log } from "@/lib/log";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAPPED_V4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

const MAPPED_V4_HEX = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;

/** Rewrites IPv4-mapped IPv6 (`::ffff:a.b.c.d` or `::ffff:hhhh:hhhh`) to plain IPv4. */
function normalizeIp(ip: string): string {
  const dotted = MAPPED_V4.exec(ip)?.[1];
  if (dotted) return dotted;
  const hex = MAPPED_V4_HEX.exec(ip);
  if (!hex) return ip;
  const n = (parseInt(hex[1] ?? "0", 16) << 16) | parseInt(hex[2] ?? "0", 16);
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

let warnedMissingForwardedFor = false;

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
    const forwarded = req.headers.get("x-forwarded-for");
    if (!forwarded && !warnedMissingForwardedFor) {
      warnedMissingForwardedFor = true;
      log.warn("x-forwarded-for missing behind trusted proxy");
    }
    const last = forwarded?.split(",").at(-1)?.trim();
    if (last && isIP(last)) return normalizeIp(last);
  }
  if (opts.socketIp) return normalizeIp(opts.socketIp);
  if (opts.local && LOOPBACK_HOSTS.has(new URL(req.url).hostname)) {
    return "127.0.0.1";
  }
  return "unknown";
}
