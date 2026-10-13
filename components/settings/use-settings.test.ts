import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import type { SettingsView } from "@/lib/api/settings-dto";
import { SettingsSchema } from "@/lib/settings/schema";
import { useSettings } from "./use-settings";

const setTheme = vi.fn();
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api/client", async (orig) => {
  const mod = await orig<typeof import("@/lib/api/client")>();
  return {
    ...mod,
    api: { settings: { put: vi.fn(), get: vi.fn(), putKey: vi.fn(), removeKey: vi.fn() } },
  };
});

const s = api.settings as unknown as Record<
  "put" | "get" | "putKey" | "removeKey",
  ReturnType<typeof vi.fn>
>;
const none = {
  source: "none",
  effective: "none",
  masked: null,
  valid: null,
  updatedAt: null,
} as const;
const initial = {
  settings: SettingsSchema.parse({}),
  warnings: [],
  secrets: { claude: none, chatgpt: none },
  savedAt: null,
  mode: "local",
} as unknown as SettingsView;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  s.put.mockImplementation(async (x: unknown) => ({
    settings: x,
    savedAt: "2026-01-01T14:32:00Z",
  }));
  s.get.mockResolvedValue(initial);
  s.putKey.mockResolvedValue({});
  s.removeKey.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

describe("useSettings", () => {
  it("debounces rapid updates into one PUT with merged settings", async () => {
    const { result } = renderHook(() => useSettings(initial));
    act(() => result.current.update({ cost: { maxSearchesPerCall: 3 } }));
    act(() => result.current.update({ cost: { maxSearchesPerCall: 4 } }));
    act(() => result.current.update({ cost: { timeoutSeconds: 60 } }));
    expect(s.put).not.toHaveBeenCalled();
    await act(async () => void (await vi.advanceTimersByTimeAsync(600)));
    expect(s.put).toHaveBeenCalledTimes(1);
    const sent = s.put.mock.calls[0]?.[0] as typeof initial.settings;
    expect(sent.cost).toEqual({ maxSearchesPerCall: 4, timeoutSeconds: 60 });
    expect(sent.appearance).toEqual(initial.settings.appearance);
    expect(result.current.savedAt).toBe("2026-01-01T14:32:00Z");
  });

  it("never mutates the previous settings objects", () => {
    const { result } = renderHook(() => useSettings(initial));
    const before = result.current.view.settings;
    act(() => result.current.update({ cost: { maxSearchesPerCall: 1 } }));
    const after = result.current.view.settings;
    expect(after).not.toBe(before);
    expect(after.cost).not.toBe(before.cost);
    expect(before.cost.maxSearchesPerCall).toBe(8);
    expect(after.providers).toBe(before.providers);
  });

  it("keeps local state and toasts when saving fails", async () => {
    s.put.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useSettings(initial));
    act(() => result.current.update({ cost: { maxSearchesPerCall: 2 } }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(600)));
    expect(toast.error).toHaveBeenCalled();
    expect(result.current.view.settings.cost.maxSearchesPerCall).toBe(2);
    expect(result.current.error).toBe("boom");
  });

  it("applies theme and reduce-motion immediately", () => {
    const { result } = renderHook(() => useSettings(initial));
    act(() => result.current.update({ appearance: { theme: "dark", reduceMotion: true } }));
    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(true);
  });

  it("refreshes the view after putKey and removeKey", async () => {
    const { result } = renderHook(() => useSettings(initial));
    await act(async () => result.current.putKey("claude", "k".repeat(30)));
    expect(s.putKey).toHaveBeenCalledWith({ provider: "claude", apiKey: "k".repeat(30) });
    expect(s.get).toHaveBeenCalledTimes(1);
    await act(async () => result.current.removeKey("claude"));
    expect(s.get).toHaveBeenCalledTimes(2);
  });

  it("flushes a pending save on unmount and reports a failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    s.put.mockRejectedValue(new Error("offline"));
    const { result, unmount } = renderHook(() => useSettings(initial));
    act(() => result.current.update({ cost: { maxSearchesPerCall: 5 } }));
    unmount();
    expect(s.put).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(warn).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("offline");
    warn.mockRestore();
  });

  it("does not flush on unmount when nothing is pending", () => {
    const { unmount } = renderHook(() => useSettings(initial));
    unmount();
    expect(s.put).not.toHaveBeenCalled();
  });
});
