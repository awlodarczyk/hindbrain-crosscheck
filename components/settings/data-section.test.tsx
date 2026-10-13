import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionListContext } from "@/components/shell/session-list-context";
import { DataSection } from "./general-view";

const m = vi.hoisted(() => ({
  importFile: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  routerRefresh: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({
  api: { sessions: { importFile: m.importFile, exportAllUrl: () => "/api/sessions/export" } },
}));
vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.routerRefresh }) }));
vi.mock("./settings-context", () => ({
  useSettingsView: () => ({ view: { mode: "hosted" }, dataDir: null }),
}));

const refresh = vi.fn().mockResolvedValue(undefined);
const setup = () =>
  render(
    <SessionListContext.Provider value={{ upsert: vi.fn(), refresh }}>
      <DataSection />
    </SessionListContext.Provider>,
  );

beforeEach(() => vi.clearAllMocks());

describe("DataSection import", () => {
  it("imports the chosen file, toasts the count and refreshes history", async () => {
    m.importFile.mockResolvedValue({ imported: 2, ids: ["a", "b"], warnings: ["w"] });
    setup();
    const file = new File(["{}"], "e.json", { type: "application/json" });
    await userEvent.setup().upload(screen.getByLabelText("Import JSON file"), file);
    await waitFor(() => expect(m.success).toHaveBeenCalledWith("Imported 2 sessions (1 warnings)"));
    expect(m.importFile).toHaveBeenCalledWith(file);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the error when the import fails", async () => {
    m.importFile.mockRejectedValue(new Error("That file is not valid JSON."));
    setup();
    await userEvent
      .setup()
      .upload(
        screen.getByLabelText("Import JSON file"),
        new File(["x"], "e.json", { type: "application/json" }),
      );
    await waitFor(() => expect(m.error).toHaveBeenCalledWith("That file is not valid JSON."));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("has an Import JSON button", () => {
    setup();
    expect(screen.getByRole("button", { name: "Import JSON" })).toBeTruthy();
  });
});
