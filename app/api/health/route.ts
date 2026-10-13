import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ok } from "@/lib/http/envelope";
import { randomToken } from "@/lib/security/crypto";
import { APP_VERSION } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(ok({ status: "ok", mode: env.APP_MODE, version: APP_VERSION }), {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": randomToken(12),
    },
  });
}
