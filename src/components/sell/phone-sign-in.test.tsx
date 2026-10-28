import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { PhoneSignIn } from "./phone-sign-in";

const calls = vi.hoisted(() => ({
  sendOtp: vi.fn(),
  options: { phone: true },
  verify: vi.fn(),
  onVerified: vi.fn(),
  success: vi.fn(),
}));
vi.mock("convex/react", () => ({ useQuery: () => calls.options }));
vi.mock("@/lib/auth-client", () => ({ authClient: { phoneNumber: calls } }));
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));
vi.mock("sonner", () => ({ toast: { success: calls.success } }));

beforeEach(() => {
  vi.resetAllMocks();
  calls.options = { phone: true };
  vi.useFakeTimers();
  calls.sendOtp.mockResolvedValue({ error: null });
  calls.verify.mockResolvedValue({
    error: null,
    data: { token: "test-session" },
  });
});
afterEach(() => vi.useRealTimers());

async function openCodeForm(shouldWaitForResend = true) {
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
  if (!shouldWaitForResend) {
    return;
  }

  vi.setSystemTime(Date.now() + 299_000);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
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

it("keeps the phone number when the user chooses to change it", async () => {
  await openCodeForm(false);
  fireEvent.click(
    screen.getByRole("button", { name: messages.sell.phone.changeNumber }),
  );
  expect(screen.getByLabelText(messages.sell.phone.label)).toHaveValue(
    "9876543210",
  );
  expect(calls.sendOtp).toHaveBeenCalledOnce();
});

it("uses elapsed time for resend when the browser resumes from the background", async () => {
  await openCodeForm(false);
  vi.setSystemTime(Date.now() + 300_000);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(
    screen.getByRole("button", { name: messages.sell.phone.resend }),
  ).toBeVisible();
});

it("does not book from the old code after Change number", async () => {
  await openCodeForm(false);
  const pending = Promise.withResolvers<{
    error: null;
    data: { token: string };
  }>();
  calls.verify.mockReturnValueOnce(pending.promise);
  fireEvent.change(screen.getByLabelText(messages.sell.phone.codeLabel), {
    target: { value: "123456" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: messages.sell.phone.changeNumber }),
  );
  await act(async () => {
    pending.resolve({ error: null, data: { token: "synthetic" } });
    await pending.promise;
  });
  expect(calls.onVerified).not.toHaveBeenCalled();
  expect(screen.getByLabelText(messages.sell.phone.label)).toHaveValue(
    "9876543210",
  );
});

it("does not show an old resend toast after Change number", async () => {
  await openCodeForm();
  const pending = Promise.withResolvers<{ error: null }>();
  calls.sendOtp.mockReturnValueOnce(pending.promise);
  fireEvent.click(
    screen.getByRole("button", { name: messages.sell.phone.resend }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: messages.sell.phone.changeNumber }),
  );
  await act(async () => {
    pending.resolve({ error: null });
    await pending.promise;
  });
  expect(calls.success).not.toHaveBeenCalled();
});

it("shows unavailable SMS delivery without dispatching a send", async () => {
  calls.options = { phone: false };
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhoneSignIn verifyLabel="Confirm" onVerified={calls.onVerified} />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    messages.auth.unavailableBody,
  );
  expect(
    screen.getByRole("button", { name: messages.sell.phone.sendCode }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText(messages.sell.phone.label), {
    target: { value: "9876543210" },
  });
  await act(async () => {
    fireEvent.keyDown(screen.getByLabelText(messages.sell.phone.label), {
      key: "Enter",
    });
    await Promise.resolve();
  });
  expect(calls.sendOtp).not.toHaveBeenCalled();
});
