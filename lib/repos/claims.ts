import { eq, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import type { Db } from "@/lib/db/client";
import { claims } from "@/lib/db/schema";
import type { Claim, NewClaim } from "./types";

const toClaim = (r: typeof claims.$inferSelect): Claim => Object.freeze({ ...r });

/** Atomically replaces all claims of a call; returns the inserted claims in idx order. */
export function replaceClaims(
  db: Db,
  callId: string,
  items: readonly NewClaim[],
): readonly Claim[] {
  return db.transaction((tx) => {
    tx.delete(claims).where(eq(claims.callId, callId)).run();
    const rows = [...items]
      .sort((a, b) => a.idx - b.idx)
      .map((c) =>
        tx
          .insert(claims)
          .values({ ...c, id: ulid(), callId })
          .returning()
          .get(),
      );
    return Object.freeze(rows.map(toClaim));
  });
}

export function listClaims(db: Db, callId: string): readonly Claim[] {
  return listClaimsForCalls(db, [callId]);
}

export function listClaimsForCalls(db: Db, callIds: readonly string[]): readonly Claim[] {
  if (callIds.length === 0) return Object.freeze([]);
  const rows = db
    .select()
    .from(claims)
    .where(inArray(claims.callId, [...callIds]))
    .orderBy(claims.callId, claims.idx)
    .all();
  return Object.freeze(rows.map(toClaim));
}
