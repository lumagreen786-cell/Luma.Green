import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { PhoneSignIn } from "./phone-sign-in";

const calls = vi.hoisted(() => ({
  sendOtp: vi.fn(),
  verify: vi.fn(),
  onVerified: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { phoneNumber: calls } }));
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));
vi.mock("sonner", () => ({ toast: { success: calls.success } }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  calls.sendOtp.mockResolvedValue({ error: null });
  calls.verify.mockResolvedValue({
    error: null,
    data: { token: "test-session" },
  });
});
afterEach(() => vi.useRealTimers());

async function openCodeForm() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhoneSignIn verifyLabel="Confirm" onVerified={calls.onVerified} />
    </NextIntlClientProvider>,
  );
  fireEvent.change(screen.getByLabelText(messages.sell.phone.label), {
    target: { value: "9876543210" },
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: messages.sell.phone.sendCode }),
    );
    await Promise.resolve();
  });
  for (let second = 0; second < 300; second++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
}

it.each([
  [429, messages.auth.sendRateLimited],
  [503, messages.sell.phone.sendFailed],
])(
  "shows resend failure %s and allows another send without verification",
  async (status, message) => {
    await openCodeForm();
    calls.sendOtp.mockResolvedValueOnce({ error: { status } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: messages.sell.phone.resend }),
      );
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    const resend = screen.getByRole("button", {
      name: messages.sell.phone.resend,
    });
    expect(resend).toBeEnabled();
    expect(calls.success).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(resend);
      await Promise.resolve();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: messages.sell.phone.resend }),
    ).not.toBeInTheDocument();
    expect(calls.success).toHaveBeenCalledExactlyOnceWith(
      messages.sell.phone.resent,
    );
    expect(calls.verify).not.toHaveBeenCalled();
    expect(calls.onVerified).not.toHaveBeenCalled();
  },
);

it("locks verification during resend and recovers from a lost connection", async () => {
  await openCodeForm();
  const request = Promise.withResolvers<{ error: null }>();
  calls.sendOtp.mockReturnValueOnce(request.promise);
  const resend = screen.getByRole("button", {
    name: messages.sell.phone.resend,
  });
  fireEvent.click(resend);
  fireEvent.click(resend);
  expect(screen.getByLabelText(messages.sell.phone.codeLabel)).toBeDisabled();
  fireEvent.change(screen.getByLabelText(messages.sell.phone.codeLabel), {
    target: { value: "123456" },
  });
  expect(calls.verify).not.toHaveBeenCalled();
  await act(async () => {
    await Promise.resolve();
  });
  expect(calls.sendOtp).toHaveBeenCalledTimes(2);
  await act(async () => {
    request.reject(new TypeError("offline"));
    await Promise.resolve();
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.sell.phone.sendFailed,
  );
  expect(resend).toBeEnabled();
  expect(screen.getByLabelText(messages.sell.phone.codeLabel)).toBeEnabled();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await Promise.resolve();
  });
  expect(calls.verify).toHaveBeenCalledTimes(1);
  expect(calls.onVerified).toHaveBeenCalledTimes(1);
});
