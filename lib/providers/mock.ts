import fixtureJson from "@/tests/fixtures/mock-answers.json";
import type { ProviderId } from "@/lib/db/enums";
import { ProviderError } from "./errors";
import type { Citation, ModelRequest, Provider, CallOptions, ModelResult } from "./types";

export type MockFixtures = {
  answers: Record<ProviderId, { text: string; citations: Citation[] }>;
  review: { text: string; citations: Citation[] };
};
export type MockOptions = {
  delayMs?: number;
  failWith?: ProviderError;
  fixtures?: MockFixtures;
  failFor?: "answer" | "review";
};

const DEFAULT_FIXTURES: MockFixtures = fixtureJson;

/** Deterministic provider serving fixture text; no network, no process spawn. */
export function createMockProvider(id: ProviderId, opts: MockOptions = {}): Provider {
  const { delayMs = 0, failWith, failFor } = opts;
  const fixtures = opts.fixtures ?? DEFAULT_FIXTURES;

  return {
    id,
    transport: "mock",
    call(req: ModelRequest, { signal, onProgress }: CallOptions): Promise<ModelResult> {
      const started = Date.now();
      const fixture = req.kind === "answer" ? fixtures.answers[id] : fixtures.review;
      const shouldFail = failWith !== undefined && (!failFor || failFor === req.kind);
      const abortError = () => new ProviderError("aborted", "mock call aborted");

      return new Promise<ModelResult>((resolve, reject) => {
        if (signal.aborted) return reject(abortError());
        const timers: ReturnType<typeof setTimeout>[] = [];
        const settle = (fn: () => void) => {
          timers.forEach(clearTimeout);
          signal.removeEventListener("abort", onAbort);
          fn();
        };
        const onAbort = () => settle(() => reject(abortError()));
        signal.addEventListener("abort", onAbort, { once: true });

        const steps = [
          () => onProgress?.({ phase: "searching", searches: 1 }),
          () => onProgress?.({ phase: "searching", searches: 2 }),
          () => onProgress?.({ phase: "writing", searches: 2 }),
        ];
        steps.forEach((step, i) => {
          if (delayMs > 0) timers.push(setTimeout(step, (delayMs * i) / (steps.length + 1)));
          else step();
        });
        timers.push(
          setTimeout(() => {
            if (shouldFail) return settle(() => reject(failWith));
            settle(() =>
              resolve({
                text: fixture.text,
                citations: fixture.citations,
                model: req.model,
                usage: { inputTokens: 1200, outputTokens: 600, searches: 2 },
                durationMs: Date.now() - started,
              }),
            );
          }, delayMs),
        );
      });
    },
    async test() {
      return { ok: true, transport: "mock", detail: "mock provider" };
    },
  };
}
