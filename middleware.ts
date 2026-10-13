import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "hc_session";

/** Hosted mode only: sends cookie-less page requests to /login. The route guards validate the session itself. */
export function middleware(req: NextRequest) {
  if (process.env.APP_MODE !== "hosted" || req.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api/|_next/|login|icon\\.svg|favicon).*)"],
};
