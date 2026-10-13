import { sessionCookieHeader } from "@/lib/auth/cookies";
import { bootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { LoginBody } from "@/lib/auth/login-body";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { createAuthSession, SESSION_TTL_MS } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getRequestDb } from "@/lib/http/deps";
import { HttpError, errors } from "@/lib/http/errors";
import { ok } from "@/lib/http/envelope";
import { defineRoute } from "@/lib/http/route";
import { isHosted } from "@/lib/mode";
import { appendEvent } from "@/lib/repos/events";
import type { Db } from "@/lib/db/client";
import { findUserByEmail, touchLogin } from "@/lib/repos/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bootstrapped = new WeakSet<Db>();

/** Ensures the env admin exists before the first login against this database. */
function ensureAdmin(db: Db): void {
  if (bootstrapped.has(db)) return;
  bootstrapAdmin(db, env);
  bootstrapped.add(db);
}

const invalid = () => new HttpError(401, "invalid_credentials", "Email or password is incorrect.");

export const POST = defineRoute({ auth: "none", op: "login", body: LoginBody }, async (args) => {
  if (!isHosted()) throw errors.notFound();
  const { ctx, body, req } = args;
  const db = getRequestDb();
  ensureAdmin(db);
  const user = findUserByEmail(db, body.email);
  const valid = await verifyPassword(user?.passwordHash ?? getDummyHash(), body.password);
  if (!user || !valid) throw invalid();
  const { token } = createAuthSession(db, user.id, {
    ip: ctx.ip,
    ua: req.headers.get("user-agent"),
  });
  touchLogin(db, user.id);
  appendEvent(db, { sessionId: null, userId: user.id, type: "login" });
  const res = Response.json(ok({ userId: user.id, email: user.email }));
  res.headers.set(
    "set-cookie",
    sessionCookieHeader(token, {
      secure: Boolean(env.APP_URL?.startsWith("https")),
      maxAgeSec: SESSION_TTL_MS / 1000,
    }),
  );
  return res;
});
