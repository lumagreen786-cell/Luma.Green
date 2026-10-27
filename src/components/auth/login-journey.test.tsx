import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { LoginFlow } from "./login-flow";

const calls = vi.hoisted(() => ({
  sendOtp: vi.fn(),
  verify: vi.fn(),
  ensure: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  auth: { isAuthenticated: false },
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { phoneNumber: calls } }));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useVerifiedSession: () => ({ isReady: false, isPending: false }),
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({ phone: true }),
  useConvexAuth: () => calls.auth,
  useMutation: () => calls.ensure,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: "a",
  usePathname: () => "/login",
  useRouter: () => ({ push: calls.push, replace: calls.replace }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("next=/join/saathi"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  calls.auth.isAuthenticated = false;
  calls.sendOtp.mockResolvedValue({ error: null });
  calls.verify.mockResolvedValue({
    error: null,
    data: { token: "test-session" },
  });
  calls.ensure.mockResolvedValue(null);
});
function form() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <LoginFlow />
    </NextIntlClientProvider>
  );
}
it("starts with phone entry and an optional language control on a fresh browser", () => {
  render(form());
  expect(screen.getByLabelText(messages.auth.mobileLabel)).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Language: English" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: messages.auth.chooseLanguage }),
  ).not.toBeInTheDocument();
});
it("sends and verifies in place, keeps the number on edit, and preserves the destination", async () => {
  const view = render(form());
  await userEvent.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9876543210",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  expect(await screen.findByLabelText(messages.auth.codeLabel)).toBeVisible();
  expect(calls.push).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.changeNumber }),
  );
  expect(screen.getByLabelText(messages.auth.mobileLabel)).toHaveValue(
    "9876543210",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  await act(async () => {
    await Promise.resolve();
    fireEvent.change(screen.getByLabelText(messages.auth.codeLabel), {
      target: { value: "123456" },
    });
  });
  expect(calls.verify).toHaveBeenCalledExactlyOnceWith({
    phoneNumber: "+919876543210",
    code: "123456",
  });
  calls.auth.isAuthenticated = true;
  await act(async () => {
    await Promise.resolve();
    view.rerender(form());
  });
  expect(calls.replace).toHaveBeenCalledExactlyOnceWith("/join/saathi");
});

it("keeps inline code entry usable when browser storage is blocked", async () => {
  const blocked = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Storage is blocked");
    });
  try {
    render(form());
    await userEvent.type(
      screen.getByLabelText(messages.auth.mobileLabel),
      "9876543210",
    );
    await userEvent.click(
      screen.getByRole("button", { name: messages.auth.sendCode }),
    );
    expect(await screen.findByLabelText(messages.auth.codeLabel)).toBeVisible();
    expect(calls.replace).not.toHaveBeenCalled();
  } finally {
    blocked.mockRestore();
  }
});

it("waits for the required authenticator instead of opening the destination after SMS", async () => {
  calls.verify.mockResolvedValueOnce({
    error: null,
    data: { twoFactorRedirect: true },
  });
  render(form());
  await userEvent.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9876543210",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  await act(async () => {
    await Promise.resolve();
    fireEvent.change(screen.getByLabelText(messages.auth.codeLabel), {
      target: { value: "123456" },
    });
  });
  expect(
    screen.getByRole("heading", { name: messages.auth.twoFactorTitle }),
  ).toBeVisible();
  expect(calls.ensure).not.toHaveBeenCalled();
  expect(calls.replace).not.toHaveBeenCalled();
});

it("keeps a sent code usable after a reload without sending another SMS", async () => {
  const user = userEvent.setup();
  const first = render(form());
  await user.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9876543210",
  );
  await user.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  expect(await screen.findByLabelText(messages.auth.codeLabel)).toBeVisible();
  first.unmount();
  render(form());
  expect(screen.getByLabelText(messages.auth.codeLabel)).toBeVisible();
  expect(calls.sendOtp).toHaveBeenCalledOnce();
});
