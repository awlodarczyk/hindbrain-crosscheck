import type { RouteContext } from "@/lib/http/route";

/** Route context as Next 15 passes it: params arrive as a promise. */
export const ctx = (params: Record<string, string> = {}): RouteContext => ({
  params: Promise.resolve(params),
});
