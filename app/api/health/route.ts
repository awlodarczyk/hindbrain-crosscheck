import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { ok } from "@/lib/http/envelope";
import { randomToken } from "@/lib/security/crypto";
import { APP_VERSION } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Touching the db applies pending migrations on first call (boot-time migration in containers). */
export function GET() {
  getDb();
  return NextResponse.json(
    ok({ status: "ok", db: "ok", mode: env.APP_MODE, version: APP_VERSION }),
    {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-request-id": randomToken(12),
      },
    },
  );
}
