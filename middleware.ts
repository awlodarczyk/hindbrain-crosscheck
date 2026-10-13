import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { securityHeaders } from "@/lib/security/headers";

const SESSION_COOKIE = "hc_session";
const PUBLIC_PAGE = /^\/login(?:\/|$)/;

/**
 * Sets a per-request CSP nonce and security headers on every response; in hosted mode also sends
 * cookie-less page requests to /login. The route guards validate the session themselves.
 * Edge exception to "process.env only via lib/env.ts": middleware cannot load the server env module.
 */
export function middleware(req: NextRequest) {
  const mode = process.env.APP_MODE === "hosted" ? "hosted" : "local";
  const nonce = generateNonce();
  const csp = buildCsp(nonce, { mode, dev: process.env.NODE_ENV !== "production" });
  const { pathname, search } = req.nextUrl;

  let res: NextResponse;
  if (
    mode === "hosted" &&
    !req.cookies.has(SESSION_COOKIE) &&
    !pathname.startsWith("/api/") &&
    !PUBLIC_PAGE.test(pathname)
  ) {
    const url = req.nextUrl.clone();
    const next = pathname + search;
    url.pathname = "/login";
    url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
    res = NextResponse.redirect(url);
  } else {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);
    res = NextResponse.next({ request: { headers: requestHeaders } });
  }
  res.headers.set("content-security-policy", csp);
  for (const [k, v] of Object.entries(securityHeaders({ mode }))) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico$|icon\\.svg$).*)"],
};
