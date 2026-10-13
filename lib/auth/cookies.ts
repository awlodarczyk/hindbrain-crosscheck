export const SESSION_COOKIE = "hc_session";

const BASE = "Path=/; HttpOnly; SameSite=Lax";

export function sessionCookieHeader(
  token: string,
  opts: { secure: boolean; maxAgeSec: number },
): string {
  return `${SESSION_COOKIE}=${token}; ${BASE}; Max-Age=${opts.maxAgeSec}${opts.secure ? "; Secure" : ""}`;
}

export function clearSessionCookieHeader(opts: { secure: boolean }): string {
  return sessionCookieHeader("", { secure: opts.secure, maxAgeSec: 0 });
}

/** Value of the named cookie in the request's Cookie header, if present. */
export function readCookie(req: Request, name: string): string | undefined {
  for (const part of req.headers.get("cookie")?.split(";") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || undefined;
  }
  return undefined;
}
