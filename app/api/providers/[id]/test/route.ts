import { ProviderParam } from "@/lib/api/settings-dto";
import { env } from "@/lib/env";
import { getRequestDb } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { createProvider, resolveProviderConfigs } from "@/lib/providers/registry";
import type { ProviderStatus } from "@/lib/providers/types";
import { getSecret } from "@/lib/repos/secrets";
import { getSettings } from "@/lib/repos/settings";
import { deriveKey } from "@/lib/security/crypto";

export const runtime = "nodejs";
const TEST_TIMEOUT_MS = 10_000;

export const POST = defineRoute({ op: "provider_test" }, async ({ ctx, params }) => {
  const id = ProviderParam.safeParse(params.id);
  if (!id.success) throw errors.notFound();
  const db = getRequestDb();
  const key = deriveKey(env.APP_SECRET, "secrets");
  const cfg = resolveProviderConfigs(
    getSettings(db, ctx.userId),
    {
      claude: getSecret(db, key, ctx.userId, "claude"),
      chatgpt: getSecret(db, key, ctx.userId, "chatgpt"),
    },
    env,
  )[id.data];
  try {
    return await createProvider(cfg).test(AbortSignal.timeout(TEST_TIMEOUT_MS));
  } catch {
    const failed: ProviderStatus = { ok: false, transport: cfg.transport, detail: "Test failed." };
    return failed;
  }
});
