import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, api } from "@/lib/api/client";
import type { HistoryItem } from "./group-by-day";
import { useSessionList } from "./use-session-list";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api/client", async (orig) => {
  const mod = await orig<typeof import("@/lib/api/client")>();
  return {
    ...mod,
    api: { sessions: { rename: vi.fn(), remove: vi.fn(), list: vi.fn() } },
  };
});

const mk = (id: string, question = id): HistoryItem => ({
  id,
  question,
  status: "done",
  claims: 1,
  disputed: 0,
  callsDone: 1,
  callsTotal: 1,
  createdAt: new Date().toISOString(),
});
const sessions = api.sessions as unknown as Record<
  "rename" | "remove" | "list",
  ReturnType<typeof vi.fn>
>;

beforeEach(() => vi.clearAllMocks());

describe("useSessionList", () => {
  it("upsert replaces by id immutably and prepends new items", () => {
    const initial = [mk("a"), mk("b")];
    const { result } = renderHook(() => useSessionList(initial));
    const prev = result.current.items;
    act(() => result.current.upsert(mk("a", "A2")));
    expect(result.current.items).not.toBe(prev);
    expect(result.current.items[0]?.question).toBe("A2");
    expect(prev[0]?.question).toBe("a");
    act(() => result.current.upsert(mk("c")));
    expect(result.current.items.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("remove filters", () => {
    const { result } = renderHook(() => useSessionList([mk("a"), mk("b")]));
    act(() => result.current.remove("a"));
    expect(result.current.items.map((i) => i.id)).toEqual(["b"]);
  });

  it("rename is optimistic", async () => {
    let done!: () => void;
    sessions.rename.mockReturnValue(new Promise<void>((r) => (done = r)));
    const { result } = renderHook(() => useSessionList([mk("a")]));
    let p!: Promise<void>;
    act(() => {
      p = result.current.rename("a", "New");
    });
    expect(result.current.items[0]?.question).toBe("New");
    await act(async () => {
      done();
      await p;
    });
    expect(result.current.items[0]?.question).toBe("New");
  });

  it("rename rolls back on error", async () => {
    sessions.rename.mockRejectedValue(new ApiClientError(500, "x", "Boom"));
    const { result } = renderHook(() => useSessionList([mk("a")]));
    await act(async () => {
      await result.current.rename("a", "New");
    });
    expect(result.current.items[0]?.question).toBe("a");
  });

  it("del removes optimistically and restores on error", async () => {
    sessions.remove.mockRejectedValue(new ApiClientError(500, "x", "Boom"));
    const { result } = renderHook(() => useSessionList([mk("a"), mk("b")]));
    await act(async () => {
      await result.current.del("a");
    });
    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]);
    sessions.remove.mockResolvedValue({ id: "a" });
    await act(async () => {
      await result.current.del("a");
    });
    expect(result.current.items.map((i) => i.id)).toEqual(["b"]);
  });

  it("refresh replaces items from the server", async () => {
    sessions.list.mockResolvedValue({ items: [mk("z")], meta: { total: 1, page: 1, limit: 50 } });
    const { result } = renderHook(() => useSessionList([mk("a")]));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.items.map((i) => i.id)).toEqual(["z"]);
  });
});
