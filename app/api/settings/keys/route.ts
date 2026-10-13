import { DeleteSecretBody, PutSecretBody } from "@/lib/api/settings-dto";
import { env } from "@/lib/env";
import { getRequestDb } from "@/lib/http/deps";
import { defineRoute } from "@/lib/http/route";
import { appendEvent } from "@/lib/repos/events";
import { deleteSecret, putSecret } from "@/lib/repos/secrets";
import { deriveKey, mask } from "@/lib/security/crypto";

export const runtime = "nodejs";

export const PUT = defineRoute({ op: "settings_write", body: PutSecretBody }, ({ ctx, body }) => {
  const db = getRequestDb();
  const key = deriveKey(env.APP_SECRET, "secrets");
  putSecret(db, key, ctx.userId, body.provider, body.apiKey, () => ctx.now);
  appendEvent(db, {
    sessionId: null,
    userId: ctx.userId,
    type: "secret_set",
    payload: { provider: body.provider },
  });
  return { provider: body.provider, masked: mask(body.apiKey) };
});

export const DELETE = defineRoute(
  { op: "settings_write", body: DeleteSecretBody },
  ({ ctx, body }) => {
    const db = getRequestDb();
    deleteSecret(db, ctx.userId, body.provider);
    appendEvent(db, {
      sessionId: null,
      userId: ctx.userId,
      type: "secret_removed",
      payload: { provider: body.provider },
    });
    return { provider: body.provider };
  },
);
