import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { isLocal } from "@/lib/mode";
import { costForBody, type OperationName } from "@/lib/rate-limit/weights";
import { browserIdFromCookie, clientIp } from "@/lib/security/ip";
import { randomToken } from "@/lib/security/crypto";
import { getAuthGuard, getLimiter } from "./deps";
import { errors, isHttpError } from "./errors";
import { fail, ok } from "./envelope";
import { DEFAULT_MAX_BODY_BYTES, hasBody, parseBody, parseQuery } from "./parse-body";
import type { RequestContext } from "./request-context";

export type RouteSpec<B, Q> = {
  auth?: "required" | "none";
  op: OperationName | ((ctx: { bodyBytes: number }) => number);
  body?: z.ZodType<B>;
  query?: z.ZodType<Q>;
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
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function errorResponse(e: unknown, requestId: string): Response {
  if (isHttpError(e)) {
    const extra: Record<string, string> = {};
    const retry = (e.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
    if (e.status === 429 && typeof retry === "number") extra["retry-after"] = String(retry);
    return withHeaders(
      NextResponse.json(fail(e.code, e.message, e.details), { status: e.status }),
      requestId,
      extra,
    );
  }
  log.error({ err: e, requestId }, "unhandled route error");
  return withHeaders(
    NextResponse.json(fail("internal", "Something went wrong."), { status: 500 }),
    requestId,
  );
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
    try {
      const session = spec.auth === "none" ? null : await getAuthGuard()(req);
      if (spec.auth !== "none" && !session) throw errors.unauthorized();
      const ctx: RequestContext = {
        userId: session?.userId ?? ANONYMOUS_USER,
        ip: clientIp(req, {
          trustProxy: env.TRUST_PROXY === "1",
          socketIp: null,
          local: isLocal(),
        }),
        browserId: browserIdFromCookie(req),
        requestId,
        now: new Date(),
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
      const cost =
        typeof spec.op === "function" ? spec.op({ bodyBytes }) : costForBody(spec.op, bodyBytes);
      const decision = await getLimiter().consume(
        { browser: ctx.browserId ?? undefined, ip: ctx.ip, user: session?.userId },
        cost,
      );
      if (!decision.allowed) throw errors.rateLimited(decision.retryAfterSec, decision.layer);
      const result = await handler({ ctx, body: parsed?.value as B, query, req, params });
      const res = result instanceof Response ? result : NextResponse.json(ok(result));
      return withHeaders(res, requestId, { "x-ratelimit-remaining": String(decision.remaining) });
    } catch (e) {
      return errorResponse(e, requestId);
    }
  };
}
