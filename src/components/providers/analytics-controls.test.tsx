import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { analyticsChoiceKey, saveAnalyticsChoice } from "@/lib/analytics";

import messages from "../../../messages/en.json";
import { AnalyticsControls } from "./analytics-controls";

const state = vi.hoisted(() => ({ path: "/", stop: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/lib/analytics-runtime", () => ({ stopAnalytics: state.stop }));
vi.mock("next/dynamic", () => {
  // The component must remain in the hoisted mock factory.
  // eslint-disable-next-line unicorn/consistent-function-scoping
  function Runtime() {
    return <span>Analytics active</span>;
  }
  return { default: () => Runtime };
});
function controls() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <AnalyticsControls />
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  saveAnalyticsChoice("denied");
  localStorage.clear();
  state.path = "/";
  state.stop.mockClear();
});
describe("automatic public analytics controls", () => {
  it("counts without a required tap and shows only optional settings", () => {
    render(controls());
    expect(screen.getByText("Analytics active")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Analytics settings" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Allow analytics" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(analyticsChoiceKey)).toBeNull();
  });
  it("honors a saved opt-out and allows a new choice", async () => {
    saveAnalyticsChoice("denied");
    const user = userEvent.setup();
    render(controls());
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Analytics settings" }),
    );
    await user.click(screen.getByRole("button", { name: "Allow analytics" }));
    expect(screen.getByText("Analytics active")).toBeVisible();
  });
  it("fails closed when storage reads fail", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    render(controls());
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
  });
  it("shows a failed opt-out and stops analytics", async () => {
    const user = userEvent.setup();
    render(controls());
    await user.click(
      screen.getByRole("button", { name: "Analytics settings" }),
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    await user.click(
      screen.getByRole("button", { name: "Keep analytics off" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("could not save");
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
    expect(state.stop).toHaveBeenCalled();
  });
  it("responds to an opt-out in another tab", () => {
    render(controls());
    localStorage.setItem(analyticsChoiceKey, "denied");
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: analyticsChoiceKey,
        newValue: "denied",
      }),
    );
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
    expect(state.stop).toHaveBeenCalled();
  });
  it("loads no runtime or controls on a private route", () => {
    state.path = "/t/private-token";
    render(controls());
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
  });
  it("offers settings on privacy without measuring it", async () => {
    state.path = "/privacy";
    const user = userEvent.setup();
    render(controls());
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Analytics settings" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Keep analytics off" }),
    );
    expect(localStorage.getItem(analyticsChoiceKey)).toBe("denied");
  });
});
