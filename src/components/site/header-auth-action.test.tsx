import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { HeaderAuthAction } from "./header-auth-action";

const state = vi.hoisted(() => ({
  person: undefined as
    undefined | null | { kind: "member" | "admin"; twoFactorEnabled: boolean },
  failed: false,
  navigate: vi.fn(),
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: () => {
    if (state.failed) throw new Error("AUTH_SERVICE_UNAVAILABLE");
    return state.person;
  },
}));
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));
beforeEach(() => {
  state.person = undefined;
  state.failed = false;
  vi.clearAllMocks();
});
function form() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <HeaderAuthAction onNavigate={state.navigate} />
    </NextIntlClientProvider>
  );
}
it("shows neutral loading while identity is unconfirmed", () => {
  render(form());
  expect(
    screen.getByRole("button", { name: messages.common.loading }),
  ).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("offers login only after confirmed sign-out", () => {
  state.person = null;
  render(form());
  expect(
    screen.getByRole("link", { name: messages.auth.metaTitle }),
  ).toHaveAttribute("href", "/login");
});
it("links a member to the app and closes the mobile menu", async () => {
  state.person = { kind: "member", twoFactorEnabled: false };
  render(form());
  const link = screen.getByRole("link", {
    name: messages.join.status.approved.open,
  });
  expect(link).toHaveAttribute("href", "/app");
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
  await userEvent.click(link);
  expect(state.navigate).toHaveBeenCalledOnce();
});
it.each([false, true])(
  "keeps admin destinations outside the locale tree (%s)",
  (twoFactorEnabled) => {
    state.person = { kind: "admin", twoFactorEnabled };
    render(form());
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      twoFactorEnabled ? "/admin" : "/admin/setup",
    );
  },
);
it("contains an unavailable identity lookup without claiming sign-out", () => {
  const silence = vi.spyOn(console, "error").mockImplementation(vi.fn());
  state.failed = true;
  render(form());
  expect(
    screen.getByRole("link", { name: messages.common.retry }),
  ).toHaveAttribute("href", "/login");
  expect(screen.queryByText(messages.auth.metaTitle)).not.toBeInTheDocument();
  silence.mockRestore();
});
