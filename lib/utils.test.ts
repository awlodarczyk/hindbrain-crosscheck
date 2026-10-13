import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges conflicting tailwind classes", () => expect(cn("p-2", "p-4")).toBe("p-4"));
  it("ignores falsy values", () => expect(cn("a", false, null, undefined, "b")).toBe("a b"));
});
