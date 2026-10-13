import { NextResponse } from "next/server";
import { toListItem } from "@/lib/api/sessions-dto";
import { getRequestDb } from "@/lib/http/deps";
import { ok } from "@/lib/http/envelope";
import { defineRoute } from "@/lib/http/route";
import { listDeletedSessions } from "@/lib/repos/sessions";

export const dynamic = "force-dynamic";

export const GET = defineRoute({ op: "read" }, ({ ctx }) => {
  const items = listDeletedSessions(getRequestDb(), ctx.userId).map(toListItem);
  return NextResponse.json(ok(items, { total: items.length, page: 1, limit: items.length }));
});
