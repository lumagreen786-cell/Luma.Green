import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { readPhone, rememberPhone } from "./storage";
import { VerifyFlow } from "./verify-flow";

const calls = vi.hoisted(() => ({
  sendOtp: vi.fn(),
  verify: vi.fn(),
  ensureProfile: vi.fn(),
  replace: vi.fn(),
  auth: { isAuthenticated: false },
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { phoneNumber: calls } }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => calls.auth,
  useMutation: () => calls.ensureProfile,
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: "a",
  useRouter: () => ({ replace: calls.replace }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("next=/join/status"),
}));
vi.mock("./login-flow", () => ({ LoginSkeleton: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T08:00:00Z"));
  calls.auth.isAuthenticated = false;
  calls.verify.mockResolvedValue({
    error: null,
    data: { token: "test-session" },
  });
  calls.sendOtp.mockResolvedValue({ error: null });
  calls.ensureProfile.mockResolvedValue(null);
  rememberPhone("+919876543210");
});
afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

function form() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <VerifyFlow />
    </NextIntlClientProvider>
  );
}

async function enterCode() {
  await act(async () => {
    await Promise.resolve();
    fireEvent.change(screen.getByLabelText(messages.auth.codeLabel), {
      target: { value: "123456" },
    });
  });
}

async function tick(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

/** Resend uses a persisted wall-clock deadline, not 300 separate renders. */
async function elapseResend(milliseconds: number) {
  vi.setSystemTime(Date.now() + milliseconds - 1000);
  await tick(1000);
}

it("bounds each session wait and retries without submitting the accepted code", async () => {
  render(form());
  await enterCode();
  expect(
    screen.getByRole("button", { name: messages.auth.signingIn }),
  ).toBeDisabled();
  await tick(19_999);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await tick(1);
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.auth.errorGeneric,
  );
  fireEvent.click(screen.getByRole("button", { name: messages.common.retry }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await tick(20_000);
  expect(
    screen.getByRole("button", { name: messages.common.retry }),
  ).toBeEnabled();
  expect(screen.getByLabelText(messages.auth.codeLabel)).toBeDisabled();
  expect(calls.verify).toHaveBeenCalledTimes(1);
  expect(calls.sendOtp).not.toHaveBeenCalled();
  expect(calls.ensureProfile).not.toHaveBeenCalled();
  expect(calls.replace).not.toHaveBeenCalled();
});

it("completes once when the session arrives after the timeout", async () => {
  const view = render(form());
  await enterCode();
  await tick(20_000);
  calls.auth.isAuthenticated = true;
  await act(async () => {
    await Promise.resolve();
    view.rerender(form());
  });
  expect(calls.ensureProfile).toHaveBeenCalledExactlyOnceWith({ locale: "en" });
  expect(calls.replace).toHaveBeenCalledExactlyOnceWith("/join/status");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  view.rerender(form());
  expect(calls.ensureProfile).toHaveBeenCalledTimes(1);
  expect(calls.verify).toHaveBeenCalledTimes(1);
});

it("retries a failed profile request without asking for another code", async () => {
  calls.auth.isAuthenticated = true;
  calls.ensureProfile.mockRejectedValueOnce(new TypeError("offline"));
  render(form());
  await enterCode();
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.auth.errorGeneric,
  );
  expect(calls.replace).not.toHaveBeenCalled();
  await act(async () => {
    await Promise.resolve();
    fireEvent.click(
      screen.getByRole("button", { name: messages.common.retry }),
    );
  });
  expect(calls.ensureProfile).toHaveBeenCalledTimes(2);
  expect(calls.replace).toHaveBeenCalledExactlyOnceWith("/join/status");
  expect(calls.verify).toHaveBeenCalledTimes(1);
  expect(calls.sendOtp).not.toHaveBeenCalled();
});

it("restores code entry after a verification network failure", async () => {
  calls.verify.mockRejectedValueOnce(new TypeError("offline"));
  render(form());
  await enterCode();
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.auth.errorGeneric,
  );
  expect(screen.getByLabelText(messages.auth.codeLabel)).toBeEnabled();
  expect(screen.getByLabelText(messages.auth.codeLabel)).toHaveValue("");
  expect(screen.getByLabelText(messages.auth.codeLabel)).toHaveFocus();
  await enterCode();
  expect(
    screen.getByRole("button", { name: messages.auth.signingIn }),
  ).toBeDisabled();
  expect(calls.verify).toHaveBeenCalledTimes(2);
});

it("blocks code verification while a resend is in progress and restores it after failure", async () => {
  const request = Promise.withResolvers<{ error: null }>();
  calls.sendOtp.mockReturnValueOnce(request.promise);
  render(form());
  await elapseResend(300_000);
  const resend = screen.getByRole("button", { name: messages.auth.resend });
  fireEvent.click(resend);
  fireEvent.click(resend);
  await enterCode();
  expect(calls.sendOtp).toHaveBeenCalledTimes(1);
  expect(calls.verify).not.toHaveBeenCalled();
  expect(screen.getByLabelText(messages.auth.codeLabel)).toBeDisabled();
  await act(async () => {
    await Promise.resolve();
    request.reject(new TypeError("offline"));
  });
  expect(screen.getByRole("alert")).toHaveTextContent(messages.auth.sendFailed);
  expect(resend).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: messages.auth.verify }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(calls.verify).toHaveBeenCalledTimes(1);
  expect(resend).toBeDisabled();
});

it("blocks resend and duplicate submission while verification is in progress", async () => {
  const request = Promise.withResolvers<{
    error: null;
    data: { token: string };
  }>();
  calls.verify.mockReturnValueOnce(request.promise);
  render(form());
  await elapseResend(300_000);
  await enterCode();
  fireEvent.click(screen.getByRole("button", { name: messages.auth.resend }));
  fireEvent.click(
    screen.getByRole("button", { name: messages.auth.verifying }),
  );
  expect(calls.verify).toHaveBeenCalledTimes(1);
  expect(calls.sendOtp).not.toHaveBeenCalled();
  await act(async () => {
    await Promise.resolve();
    request.resolve({ error: null, data: { token: "test-session" } });
  });
  expect(
    screen.getByRole("button", { name: messages.auth.signingIn }),
  ).toBeDisabled();
});

it("ignores obsolete preview storage and returns to phone entry", () => {
  sessionStorage.removeItem("lg.signInPhone");
  sessionStorage.setItem("lg.signInPreview", "+919876543210");
  render(form());
  expect(calls.replace).toHaveBeenCalledWith("/login");
  expect(calls.verify).not.toHaveBeenCalled();
  expect(calls.sendOtp).not.toHaveBeenCalled();
  expect(calls.ensureProfile).not.toHaveBeenCalled();
});

it("counts down five minutes and retains the remaining wait after remount", async () => {
  const view = render(form());
  expect(screen.getByText(/5:00/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: messages.auth.resend }),
  ).not.toBeInTheDocument();
  await elapseResend(60_000);
  expect(screen.getByText(/4:00/)).toBeVisible();
  view.unmount();
  render(form());
  expect(screen.getByText(/4:00/)).toBeVisible();
  await elapseResend(239_000);
  expect(screen.getByText(/0:01/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: messages.auth.resend }),
  ).not.toBeInTheDocument();
  await tick(1000);
  fireEvent.click(screen.getByRole("button", { name: messages.auth.resend }));
  await tick(0);
  expect(calls.sendOtp).toHaveBeenCalledOnce();
  expect(screen.getByText(/5:00/)).toBeVisible();
});

it("keeps the phone number when editing from the compatibility code route", () => {
  render(form());
  fireEvent.click(
    screen.getByRole("button", { name: messages.auth.changeNumber }),
  );
  expect(screen.getByLabelText(messages.auth.mobileLabel)).toHaveValue(
    "9876543210",
  );
  expect(calls.replace).not.toHaveBeenCalled();
});

it("does not clear a newer challenge or navigate after a profile request outlives the form", async () => {
  const pending = Promise.withResolvers<null>();
  calls.ensureProfile.mockReturnValueOnce(pending.promise);
  calls.auth.isAuthenticated = true;
  const view = render(form());
  await enterCode();
  expect(calls.ensureProfile).toHaveBeenCalledTimes(1);
  view.unmount();
  rememberPhone("+919876543211");
  await act(async () => {
    pending.resolve(null);
    await pending.promise;
  });
  expect(readPhone()).toBe("+919876543211");
  expect(calls.replace).not.toHaveBeenCalled();
});

it("does not replace a newer challenge when an old resend completes after unmount", async () => {
  const pending = Promise.withResolvers<{ error: null }>();
  calls.sendOtp.mockReturnValueOnce(pending.promise);
  const view = render(form());
  await elapseResend(300_000);
  fireEvent.click(screen.getByRole("button", { name: messages.auth.resend }));
  view.unmount();
  rememberPhone("+919876543211");
  await act(async () => {
    pending.resolve({ error: null });
    await pending.promise;
  });
  expect(readPhone()).toBe("+919876543211");
  expect(calls.replace).not.toHaveBeenCalled();
});
