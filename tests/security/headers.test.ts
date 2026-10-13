import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ctx } from "../helpers/route-ctx";
import { installHarness, newUser, uninstallHarness } from "./harness";

const API_DIR = join(process.cwd(), "app", "api");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? routeFiles(p) : name === "route.ts" ? [p] : [];
  });
}

const paramsOf = (file: string): Record<string, string> =>
  Object.fromEntries(
    [...relative(API_DIR, file).matchAll(/\[(\w+)\]/g)].map((m) => [m[1] ?? "", "nonexistent1"]),
  );

beforeEach(() => {
  const h = installHarness();
  h.as(newUser(h.db, "a@example.com"));
});
afterEach(uninstallHarness);

const files = routeFiles(API_DIR);

describe("api response headers", () => {
  it("finds the route files", () => expect(files.length).toBeGreaterThan(10));

  it.each(files.map((f) => [relative(API_DIR, f).split(sep).join("/"), f] as const))(
    "%s sets nosniff, no-store and a request id on every method",
    async (_name, file) => {
      const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
      for (const m of METHODS) {
        const handler = mod[m];
        if (typeof handler !== "function") continue;
        const req = new Request("http://localhost/api/probe", {
          method: m,
          headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" },
          body: m === "GET" ? undefined : "{}",
        });
        const res = (await handler(req, ctx(paramsOf(file)))) as Response;
        expect(res.headers.get("x-content-type-options"), `${m} nosniff`).toBe("nosniff");
        expect(res.headers.get("cache-control"), `${m} cache-control`).toBe("no-store");
        expect(res.headers.get("x-request-id"), `${m} request id`).toBeTruthy();
        await res.body?.cancel();
      }
    },
  );
});
