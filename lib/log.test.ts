import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { childLogger, createLogger, log } from "./log";

const capture = () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  return { lines, logger: createLogger("info", stream) };
};

describe("log", () => {
  it("redacts secrets", () => {
    const { lines, logger } = capture();
    logger.info(
      { provider: { apiKey: "sk-secret" }, req: { headers: { authorization: "Bearer t" } } },
      "x",
    );
    const out = lines.join("");
    expect(out).not.toContain("sk-secret");
    expect(out).not.toContain("Bearer t");
    expect(out).toContain("hindbrain-crosscheck");
  });
  it("is silent under vitest and supports child loggers", () => {
    expect(log.level).toBe("silent");
    expect(childLogger({ requestId: "r" }).level).toBe("silent");
  });
});
