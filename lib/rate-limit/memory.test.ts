import { describe, expect, it } from "vitest";
import { createMemoryLimiter } from "./memory";
import { BUDGETS } from "./weights";

const setup = (budgets = BUDGETS) => {
  let t = 1_000_000;
  const limiter = createMemoryLimiter(budgets, () => t);
  return { limiter, advance: (ms: number) => (t += ms) };
};

describe("memory limiter", () => {
  it("denies the 31st ask on the browser layer", async () => {
    const { limiter } = setup();
    const keys = { browser: "b1", ip: "1.1.1.1" };
    for (let i = 0; i < 30; i++) expect((await limiter.consume(keys, 10)).allowed).toBe(true);
    const d = await limiter.consume(keys, 10);
    expect(d).toMatchObject({ allowed: false, layer: "browser" });
    expect(d.retryAfterSec).toBeGreaterThan(0);
  });

  it("refills over time", async () => {
    const { limiter, advance } = setup();
    const keys = { browser: "b1", ip: "1.1.1.1" };
    for (let i = 0; i < 30; i++) await limiter.consume(keys, 10);
    advance(600_000);
    expect((await limiter.consume(keys, 10)).allowed).toBe(true);
  });

  it("keeps ip independent of browser", async () => {
    const { limiter } = setup();
    for (let i = 0; i < 30; i++) await limiter.consume({ browser: "b1", ip: "1.1.1.1" }, 10);
    expect((await limiter.consume({ browser: "b2", ip: "1.1.1.1" }, 10)).allowed).toBe(true);
  });

  it("does not partially consume when one layer denies", async () => {
    const { limiter } = setup();
    for (let i = 0; i < 30; i++) await limiter.consume({ browser: "b1", ip: "1.1.1.1" }, 10);
    const before = await limiter.consume({ ip: "1.1.1.1" }, 0);
    await limiter.consume({ browser: "b1", ip: "1.1.1.1" }, 10);
    const after = await limiter.consume({ ip: "1.1.1.1" }, 0);
    expect(after.remaining).toBe(before.remaining);
  });

  it("skips layers whose key is missing and reports remaining", async () => {
    const { limiter } = setup();
    const d = await limiter.consume({ ip: "9.9.9.9" }, 10);
    expect(d).toMatchObject({ allowed: true, layer: null, remaining: 2990 });
  });

  it("reports the first exhausted layer in browser, ip, user order", async () => {
    const { limiter } = setup({
      browser: { points: 5, windowSec: 10 },
      ip: { points: 5, windowSec: 10 },
      user: { points: 5, windowSec: 10 },
    });
    const d = await limiter.consume({ browser: "b", ip: "i", user: "u" }, 6);
    expect(d.layer).toBe("browser");
  });

  it("prunes idle entries without breaking later use", async () => {
    const { limiter, advance } = setup();
    await limiter.consume({ ip: "a" }, 1);
    advance(700_000);
    expect((await limiter.consume({ ip: "b" }, 1)).remaining).toBe(2999);
  });
});
