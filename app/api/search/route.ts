import { z } from "zod";
import { getRequestDb } from "@/lib/http/deps";
import { defineRoute } from "@/lib/http/route";
import { searchSessions } from "@/lib/repos/search";

export const dynamic = "force-dynamic";

const SearchQuery = z.object({
  q: z.string().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = defineRoute({ op: "read", query: SearchQuery }, ({ ctx, query }) =>
  searchSessions(getRequestDb(), ctx.userId, query.q, query.limit),
);
