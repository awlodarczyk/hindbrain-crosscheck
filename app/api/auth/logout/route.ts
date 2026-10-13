import { clearSessionCookieHeader, readCookie, SESSION_COOKIE } from "@/lib/auth/cookies";
import { revokeAuthSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getRequestDb } from "@/lib/http/deps";
import { ok } from "@/lib/http/envelope";
import { defineRoute } from "@/lib/http/route";
import { appendEvent } from "@/lib/repos/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = defineRoute({ auth: "required", op: "logout" }, ({ ctx, req }) => {
  const db = getRequestDb();
  const token = readCookie(req, SESSION_COOKIE);
  if (token) revokeAuthSession(db, token);
  appendEvent(db, { sessionId: null, userId: ctx.userId, type: "logout" });
  const res = Response.json(ok({ ok: true }));
  res.headers.set(
    "set-cookie",
    clearSessionCookieHeader({ secure: Boolean(env.APP_URL?.startsWith("https")) }),
  );
  return res;
});
