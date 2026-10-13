import { describe, expect, it } from "vitest";
import { isHosted, isLocal } from "./mode";

describe("mode", () => {
  it("detects hosted", () => {
    expect(isHosted({ APP_MODE: "hosted" })).toBe(true);
    expect(isLocal({ APP_MODE: "hosted" })).toBe(false);
  });
  it("detects local", () => {
    expect(isLocal({ APP_MODE: "local" })).toBe(true);
    expect(isHosted({ APP_MODE: "local" })).toBe(false);
  });
});
