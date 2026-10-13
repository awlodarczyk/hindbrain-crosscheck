import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/test-db";
import { createLogger } from "@/lib/log";
import { listCallsForSession } from "@/lib/repos/calls";
import { createSession } from "@/lib/repos/sessions";
import { ensureLocalUser, LOCAL_USER_ID } from "@/lib/repos/users";
import { ProviderError } from "@/lib/providers/errors";
import { createMockProvider } from "@/lib/providers/mock";
import { runSession } from "@/lib/pipeline/run-session";
import type { RunEvent } from "@/lib/pipeline/events";
import { scrubSecrets } from "@/lib/security/scrub";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";

const KEY = "sk-ant-TESTKEY-SHOULD-NOT-LEAK";
const OPAQUE = "opaque-secret-value-123";

function capture() {
  const lines: string[] = [];
  const logger = createLogger("debug", { write: (s: string) => void lines.push(s) });
  return { logger, output: () => lines.join("\n") };
}

describe("log redaction", () => {
  it.each([
    ["req headers", { req: { headers: { authorization: OPAQUE, cookie: OPAQUE } } }],
    ["nested err config", { err: { config: { headers: { authorization: OPAQUE } } } }],
    ["generic headers", { res: { headers: { authorization: OPAQUE, cookie: OPAQUE } } }],
    ["x-api-key", { upstream: { headers: { "x-api-key": OPAQUE } } }],
    ["set-cookie", { res: { "set-cookie": OPAQUE } }],
    ["top-level", { authorization: OPAQUE, cookie: OPAQUE, "x-api-key": OPAQUE }],
    ["apiKey", { apiKey: OPAQUE }],
    ["nested apiKey", { provider: { apiKey: OPAQUE } }],
    ["deep apiKey", { a: { provider: { apiKey: OPAQUE } } }],
    ["password/ciphertext/token", { u: { password: OPAQUE, ciphertext: OPAQUE, token: OPAQUE } }],
  ])("redacts %s", (_n, obj) => {
    const { logger, output } = capture();
    logger.info(obj, "x");
    expect(output()).not.toContain(OPAQUE);
  });

  it("masks key-shaped strings in messages and error text", () => {
    const { logger, output } = capture();
    logger.error({ err: new Error(`failed with ${KEY}`) }, `Bearer abc.def-123 and ${KEY}`);
    logger.info({ note: `Authorization: Bearer ${KEY}` }, "x");
    expect(output()).not.toContain(KEY);
    expect(output()).not.toContain("abc.def-123");
  });

  it("redacts secrets carried on an Error instance", () => {
    const { logger, output } = capture();
    const err = Object.assign(new Error("boom"), {
      config: { headers: { authorization: OPAQUE } },
    });
    logger.error({ err }, "x");
    expect(output()).not.toContain(OPAQUE);
  });
});

describe("scrubSecrets", () => {
  it("masks sk- keys and bearer tokens only", () => {
    expect(scrubSecrets(`a ${KEY} b Bearer abc.DEF_1-2 c`)).toBe("a [redacted] b [redacted] c");
    expect(scrubSecrets("sk-short and plain text")).toBe("sk-short and plain text");
  });
});

describe("pipeline failure text", () => {
  it("never persists or emits a provider key", async () => {
    const db = createTestDb();
    ensureLocalUser(db);
    const sid = createSession(db, {
      userId: LOCAL_USER_ID,
      question: "q?",
      mode: "ask",
      settingsSnapshot: DEFAULT_SETTINGS,
    }).id;
    const events: RunEvent[] = [];
    const failing = createMockProvider("chatgpt", {
      failWith: new ProviderError("provider_http", `boom ${KEY}`),
    });
    await runSession(
      {
        db,
        providers: { claude: createMockProvider("claude"), chatgpt: failing },
        settings: DEFAULT_SETTINGS,
        emit: (e) => events.push(e),
      },
      sid,
      { reason: "initial" },
    );
    const failed = listCallsForSession(db, sid).filter((c) => c.status === "failed");
    expect(failed.length).toBeGreaterThan(0);
    failed.forEach((c) => expect(c.errorMessage).not.toContain(KEY));
    expect(JSON.stringify(events)).not.toContain(KEY);
  });
});
