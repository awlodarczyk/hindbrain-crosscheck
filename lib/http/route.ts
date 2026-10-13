import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { isLocal } from "@/lib/mode";
import { effectiveCost } from "@/lib/rate-limit/risk";
import { costForBody, type OperationName } from "@/lib/rate-limit/weights";
import { clientIp } from "@/lib/security/ip";
import { deriveKey, randomToken } from "@/lib/security/crypto";
import {
  BROWSER_ID_COOKIE,
  browserIdCookieHeader,
  issueBrowserId,
  verifyBrowserId,
} from "@/lib/security/client-id";
import { getAuthGuard, getLimiter, getNow } from "./deps";
import { errors, isHttpError } from "./errors";
import { fail, ok } from "./envelope";
import { DEFAULT_MAX_BODY_BYTES, hasBody, parseBody, parseQuery } from "./parse-body";
import type { RequestContext } from "./request-context";

export type RouteSpec<B, Q> = {
  auth?: "required" | "none";
  op: OperationName | ((ctx: { bodyBytes: number }) => number);
  body?: z.ZodType<B, z.ZodTypeDef, unknown>;
  query?: z.ZodType<Q, z.ZodTypeDef, unknown>;
  maxBodyBytes?: number;
  contentType?: "application/json";
};
export type RouteArgs<B, Q> = {
  ctx: RequestContext;
  body: B;
  query: Q;
  req: Request;
  params: Record<string, string>;
};
export type RouteHandler<B, Q> = (
  args: RouteArgs<B, Q>,
) => Promise<Response | unknown> | Response | unknown;
type RouteCtx = { params?: Promise<Record<string, string>> | Record<string, string> };

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;
const ANONYMOUS_USER = "anonymous";

function withHeaders(res: Response, requestId: string, extra: Record<string, string> = {}) {
  const headers = new Headers(res.headers);
  headers.set("x-request-id", requestId);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  for (const [k, v] of Object.entries(extra)) {
    if (k === "set-cookie") headers.append(k, v);
    else headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function errorResponse(e: unknown, requestId: string, cookie?: Record<string, string>): Response {
  if (isHttpError(e)) {
    const extra: Record<string, string> = {};
    const retry = (e.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
    if (e.status === 429 && typeof retry === "number") extra["retry-after"] = String(retry);
    return withHeaders(
      NextResponse.json(fail(e.code, e.message, e.details), { status: e.status }),
      requestId,
      { ...extra, ...cookie },
    );
  }
  log.error({ err: e, requestId }, "unhandled route error");
  return withHeaders(
    NextResponse.json(fail("internal", "Something went wrong."), { status: 500 }),
    requestId,
    cookie,
  );
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of req.headers.get("cookie")?.split(";") ?? []) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

/** Verified browser id and age, or a freshly issued id plus the `set-cookie` header to send. */
function resolveBrowserId(req: Request, now: Date) {
  const secret = deriveKey(env.APP_SECRET, "cookie");
  const valid = verifyBrowserId(secret, readCookie(req, BROWSER_ID_COOKIE), now);
  if (valid) return { id: valid.id, ageSec: valid.ageSec, cookie: undefined };
  const value = issueBrowserId(secret, now);
  const cookie = {
    "set-cookie": browserIdCookieHeader(value, {
      secure: env.APP_URL?.startsWith("https://") ?? false,
    }),
  };
  return { id: value.split(".")[0] ?? value, ageSec: null, cookie };
}

/**
 * Points to charge. Function ops have no operation name, so they bypass the risk multiplier.
 */
function chargeFor(
  op: RouteSpec<unknown, unknown>["op"],
  bodyBytes: number,
  browserIdAgeSec: number | null,
  authenticated: boolean,
): number {
  if (typeof op === "function") return op({ bodyBytes });
  const base = costForBody(op, bodyBytes);
  return effectiveCost(base, {
    browserIdAgeSec,
    authenticated,
    op,
  });
}

/**
 * Wraps a handler with request id, auth, query/body validation, rate limiting and the response envelope.
 * Order: auth, params, query, body, then limiter (after validation so invalid requests cost nothing), then handler.
 */
export function defineRoute<B = undefined, Q = undefined>(
  spec: RouteSpec<B, Q>,
  handler: RouteHandler<B, Q>,
): (req: Request, routeCtx?: RouteCtx) => Promise<Response> {
  return async (req, routeCtx) => {
    const header = req.headers.get("x-request-id");
    const requestId = header && REQUEST_ID.test(header) ? header : randomToken(12);
    let cookie: Record<string, string> | undefined;
    try {
      const now = getNow();
      const browser = resolveBrowserId(req, now);
      cookie = browser.cookie;
      const session = spec.auth === "none" ? null : await getAuthGuard()(req);
      if (spec.auth !== "none" && !session) throw errors.unauthorized();
      const ctx: RequestContext = {
        userId: session?.userId ?? ANONYMOUS_USER,
        ip: clientIp(req, {
          trustProxy: env.TRUST_PROXY === "1",
          socketIp: null,
          local: isLocal(),
        }),
        browserId: browser.id,
        requestId,
        now,
      };
      const params = (await routeCtx?.params) ?? {};
      const query = (spec.query ? parseQuery(req, spec.query) : undefined) as Q;
      const parsed =
        spec.body && hasBody(req)
          ? await parseBody(req, spec.body, {
              maxBytes: spec.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
              contentType: spec.contentType ?? "application/json",
            })
          : null;
      const bodyBytes = parsed?.bytes ?? 0;
      const cost = chargeFor(
        spec.op,
        bodyBytes,
        browser.ageSec,
        session !== null && session.userId !== ANONYMOUS_USER,
      );
      const decision = await getLimiter().consume(
        { browser: ctx.browserId ?? undefined, ip: ctx.ip, user: session?.userId },
        cost,
      );
      if (!decision.allowed) throw errors.rateLimited(decision.retryAfterSec, decision.layer, cost);
      const result = await handler({ ctx, body: parsed?.value as B, query, req, params });
      const res = result instanceof Response ? result : NextResponse.json(ok(result));
      return withHeaders(res, requestId, {
        "x-ratelimit-remaining": String(decision.remaining),
        "x-ratelimit-cost": String(cost),
        ...cookie,
      });
    } catch (e) {
      return errorResponse(e, requestId, cookie);
    }
  };
}
