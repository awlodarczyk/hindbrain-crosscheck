import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppearanceApplier } from "./appearance-applier";

const setTheme = vi.hoisted(() => vi.fn());
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme }) }));

const root = document.documentElement;
beforeEach(() => vi.clearAllMocks());
afterEach(() => root.classList.remove("reduce-motion"));

describe("AppearanceApplier", () => {
  it("applies initial theme and reduce motion on mount", () => {
    render(<AppearanceApplier initial={{ theme: "dark", reduceMotion: true }} />);
    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(root).toHaveClass("reduce-motion");
  });

  it("applies changes from hc:appearance-changed", () => {
    render(<AppearanceApplier initial={{ theme: "light", reduceMotion: true }} />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("hc:appearance-changed", {
          detail: { theme: "system", reduceMotion: false },
        }),
      );
    });
    expect(setTheme).toHaveBeenLastCalledWith("system");
    expect(root).not.toHaveClass("reduce-motion");
  });

  it("ignores absent fields and stops listening after unmount", () => {
    const { unmount } = render(
      <AppearanceApplier initial={{ theme: "light", reduceMotion: false }} />,
    );
    act(() => {
      window.dispatchEvent(new CustomEvent("hc:appearance-changed", { detail: {} }));
    });
    expect(setTheme).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      window.dispatchEvent(new CustomEvent("hc:appearance-changed", { detail: { theme: "dark" } }));
    });
    expect(setTheme).toHaveBeenCalledTimes(1);
  });
});
