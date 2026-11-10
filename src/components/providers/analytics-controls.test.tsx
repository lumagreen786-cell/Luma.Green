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
describe("optional analytics controls", () => {
  it("does not activate analytics until the visitor opts in", async () => {
    const user = userEvent.setup();
    render(controls());
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Allow analytics" }));
    expect(screen.getByText("Analytics active")).toBeInTheDocument();
    expect(localStorage.getItem(analyticsChoiceKey)).toBe("granted");
    expect(
      screen.getByRole("button", { name: "Turn off analytics" }),
    ).toBeVisible();
  });
  it("keeps the page usable when declined and lets the visitor change the choice", async () => {
    const user = userEvent.setup();
    render(controls());
    await user.click(
      screen.getByRole("button", { name: "Keep analytics off" }),
    );
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Analytics settings" }),
    );
    expect(
      screen.getByRole("button", { name: "Allow analytics" }),
    ).toBeVisible();
  });
  it("shows the storage failure and keeps analytics off", async () => {
    const user = userEvent.setup();
    render(controls());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    await user.click(screen.getByRole("button", { name: "Allow analytics" }));
    expect(screen.getByRole("alert")).toHaveTextContent("could not save");
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
    expect(state.stop).toHaveBeenCalled();
  });
  it("responds to consent withdrawal in another tab", () => {
    saveAnalyticsChoice("granted");
    render(controls());
    expect(screen.getByText("Analytics active")).toBeInTheDocument();
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
  it("shows no consent panel in booking or private routes", () => {
    state.path = "/t/private-token";
    render(controls());
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
  it("offers direct withdrawal from the privacy notice", async () => {
    state.path = "/privacy";
    saveAnalyticsChoice("granted");
    const user = userEvent.setup();
    render(controls());
    await user.click(
      screen.getByRole("button", { name: "Turn off analytics" }),
    );
    expect(localStorage.getItem(analyticsChoiceKey)).toBe("denied");
    expect(screen.queryByText("Analytics active")).not.toBeInTheDocument();
    expect(state.stop).toHaveBeenCalled();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
  it("does not ask for a new choice on the privacy notice", () => {
    state.path = "/privacy";
    render(controls());
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
