import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMedia } from "./use-media";

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: vi.fn((_: string, l: Listener) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: Listener) => listeners.delete(l)),
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
  return {
    mql,
    listeners,
    set(next: boolean) {
      mql.matches = next;
      listeners.forEach((l) => l());
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("useMedia", () => {
  it("reports the current match and follows changes", () => {
    const m = mockMatchMedia(false);
    const { result } = renderHook(() => useMedia("(max-width: 768px)"));
    expect(result.current).toBe(false);
    act(() => m.set(true));
    expect(result.current).toBe(true);
  });

  it("reads the initial match after mount", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMedia("(max-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("removes the listener on unmount", () => {
    const m = mockMatchMedia(false);
    const { unmount } = renderHook(() => useMedia("(max-width: 768px)"));
    expect(m.listeners.size).toBe(1);
    unmount();
    expect(m.listeners.size).toBe(0);
  });
});
