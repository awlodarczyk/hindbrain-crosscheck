import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let nextParam: string | null = null;
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nextParam ? { next: nextParam } : {}),
}));

import { LoginForm, safeNext } from "./login-form";

const fetchMock = vi.fn();
beforeEach(() => {
  nextParam = null;
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "a@example.test");
  await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginForm", () => {
  it("posts credentials and navigates to next on success", async () => {
    nextParam = "/history";
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    render(<LoginForm />);
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/history"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/login");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "a@example.test",
      password: "hunter2hunter2",
    });
  });
  it("shows the generic error on 401", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    render(<LoginForm />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(push).not.toHaveBeenCalled();
  });
  it("shows a retry message on 429 and on network failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    render(<LoginForm />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not sign in"));
  });
  it("sanitises next", () => {
    expect(safeNext("/a?b=1")).toBe("/a?b=1");
    expect(safeNext("//evil.test")).toBe("/");
    expect(safeNext("https://evil.test")).toBe("/");
    expect(safeNext("/\\evil.test")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
