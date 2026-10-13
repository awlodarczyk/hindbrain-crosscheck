import { verifyRevealPassword } from "@/lib/api/reveal-guard";
import { RevealBody } from "@/lib/api/settings-dto";
import { env } from "@/lib/env";
import { getRequestDb } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { isHosted } from "@/lib/mode";
import { appendEvent } from "@/lib/repos/events";
import { getSecret } from "@/lib/repos/secrets";
import { deriveKey } from "@/lib/security/crypto";

export const runtime = "nodejs";

/** The only response that carries a plaintext key. */
export const POST = defineRoute(
  { op: "reveal_secret", body: RevealBody },
  async ({ ctx, body }) => {
    const db = getRequestDb();
    if (isHosted()) {
      if (!body.password) {
        throw errors.badRequest({
          issues: [{ path: ["password"], message: "Password is required." }],
        });
      }
      await verifyRevealPassword(db, ctx.userId, body.password);
    }
    const apiKey = getSecret(db, deriveKey(env.APP_SECRET, "secrets"), ctx.userId, body.provider);
    if (apiKey === null) throw errors.notFound();
    appendEvent(db, {
      sessionId: null,
      userId: ctx.userId,
      type: "reveal_secret",
      payload: { provider: body.provider },
    });
    return { provider: body.provider, apiKey };
  },
);
