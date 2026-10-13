import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUCKET_LUA } from "./bucket-script";

describe("BUCKET_LUA", () => {
  it("equals bucket.lua", () => {
    expect(BUCKET_LUA).toBe(readFileSync(join(__dirname, "bucket.lua"), "utf8"));
  });
});
