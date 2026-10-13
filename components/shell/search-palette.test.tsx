import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { SearchPalette } from "./search-palette";

vi.mock("@/lib/api/client", () => ({ api: { search: vi.fn() } }));
const search = api.search as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  search.mockReset();
});
afterEach(() => vi.useRealTimers());

const hit = {
  id: "s1",
  question: "Static stretching",
  snippet: "about <mark>stretching</mark>",
  createdAt: "",
};

async function typeQuery(q: string) {
  fireEvent.change(screen.getByPlaceholderText("Search sessions…"), { target: { value: q } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(160);
  });
}

describe("SearchPalette", () => {
  it("renders nothing when closed", () => {
    render(<SearchPalette open={false} onOpenChange={() => {}} onSelect={() => {}} />);
    expect(screen.queryByPlaceholderText("Search sessions…")).toBeNull();
  });

  it("debounces search and renders hits with a mark", async () => {
    search.mockResolvedValue([hit]);
    render(<SearchPalette open onOpenChange={() => {}} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search sessions…"), { target: { value: "str" } });
    expect(search).not.toHaveBeenCalled();
    await typeQuery("stretch");
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("stretch");
    expect(screen.getByText("Static stretching")).toBeInTheDocument();
    expect(document.querySelector("mark")?.textContent).toBe("stretching");
  });

  it("selects the active hit with Enter and closes", async () => {
    search.mockResolvedValue([hit]);
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<SearchPalette open onOpenChange={onOpenChange} onSelect={onSelect} />);
    await typeQuery("stretch");
    fireEvent.keyDown(screen.getByPlaceholderText("Search sessions…"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("s1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the empty state", async () => {
    search.mockResolvedValue([]);
    render(<SearchPalette open onOpenChange={() => {}} onSelect={() => {}} />);
    await typeQuery("zzz");
    expect(screen.getByText("No sessions match")).toBeInTheDocument();
  });

  it("shows a searching state while pending", async () => {
    search.mockReturnValue(new Promise(() => {}));
    render(<SearchPalette open onOpenChange={() => {}} onSelect={() => {}} />);
    await typeQuery("abc");
    expect(screen.getByText("Searching…")).toBeInTheDocument();
  });
});
