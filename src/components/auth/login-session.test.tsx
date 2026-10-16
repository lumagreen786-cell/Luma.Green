import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { LoginFlow } from "./login-flow";

const state = vi.hoisted(() => ({
  session: { isReady: false, isPending: true },
  ensure: vi.fn(),
  replace: vi.fn(),
  next: "/join/kabadiwala",
  person: { kind: "member", twoFactorEnabled: false },
  admin: vi.fn(),
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useVerifiedSession: () => state.session,
}));
vi.mock("convex/react", () => ({
  useQuery: () => state.person,
  useMutation: () => state.ensure,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("@/lib/admin-navigation", () => ({ navigateToAdmin: state.admin }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ next: state.next }),
}));
vi.mock("./storage", () => ({
  isLanguageChosen: () => true,
  useStoredValue: () => true,
}));
vi.mock("./phone-form", () => ({ PhoneForm: () => <p>Phone form</p> }));
vi.mock("./language-choice", () => ({ LanguageChoice: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { isReady: false, isPending: true };
  state.ensure.mockResolvedValue("profile");
  state.person = { kind: "member", twoFactorEnabled: false };
  state.next = "/join/kabadiwala";
});
function form() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <LoginFlow />
    </NextIntlClientProvider>
  );
}
it("waits for verified session state before showing phone entry or resuming", () => {
  const view = render(form());
  expect(screen.queryByText("Phone form")).not.toBeInTheDocument();
  expect(state.ensure).not.toHaveBeenCalled();
  state.session = { isReady: false, isPending: false };
  view.rerender(form());
  expect(screen.getByText("Phone form")).toBeVisible();
  expect(state.replace).not.toHaveBeenCalled();
});
it("resumes an existing fully verified session without asking for another code", async () => {
  state.session = { isReady: true, isPending: false };
  render(form());
  await waitFor(() => {
    expect(state.replace).toHaveBeenCalledWith("/join/kabadiwala");
  });
  expect(state.ensure).toHaveBeenCalledExactlyOnceWith({ locale: "en" });
  expect(screen.queryByText("Phone form")).not.toBeInTheDocument();
});
it("rejects an external continuation and recovers a failed profile setup on retry", async () => {
  state.session = { isReady: true, isPending: false };
  state.next = "https://example.test";
  state.ensure.mockRejectedValueOnce(new Error("Unavailable"));
  render(form());
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.common.error,
  );
  expect(state.replace).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: messages.common.retry }),
  );
  await waitFor(() => {
    expect(state.replace).toHaveBeenCalledWith("/app");
  });
  expect(state.ensure).toHaveBeenCalledTimes(2);
});

it.each([false, true])(
  "resumes administrators into their protected admin flow (%s)",
  async (twoFactorEnabled) => {
    state.session = { isReady: true, isPending: false };
    state.person = { kind: "admin", twoFactorEnabled };
    render(form());
    await waitFor(() => {
      expect(state.admin).toHaveBeenCalledWith(twoFactorEnabled);
    });
    expect(state.replace).not.toHaveBeenCalled();
  },
);

it("does not navigate when an earlier resume request finishes after leaving login", async () => {
  state.session = { isReady: true, isPending: false };
  const { promise, resolve } = Promise.withResolvers<string>();
  state.ensure.mockReturnValueOnce(promise);
  const view = render(form());
  expect(state.ensure).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => {
    resolve("profile");
    await promise;
  });
  expect(state.replace).not.toHaveBeenCalled();
  expect(state.admin).not.toHaveBeenCalled();
});
