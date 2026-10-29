import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { PhoneForm } from "./phone-form";

const calls = vi.hoisted(() => ({
  sendOtp: vi.fn(),
  push: vi.fn(),
  rememberPhone: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { phoneNumber: { sendOtp: calls.sendOtp } },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: "a",
  useRouter: () => ({ push: calls.push }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("next=/app"),
}));
vi.mock("./storage", () => ({
  rememberPhone: calls.rememberPhone,
}));
beforeEach(() => vi.resetAllMocks());

it("restores the send button after a network error and completes a retry", async () => {
  calls.sendOtp
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce({ error: null });
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhoneForm />
    </NextIntlClientProvider>,
  );
  await userEvent.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9876543210",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.auth.sendFailed,
  );
  const retry = screen.getByRole("button", { name: messages.auth.sendCode });
  expect(retry).toBeEnabled();
  expect(calls.push).not.toHaveBeenCalled();
  await userEvent.click(retry);
  expect(calls.rememberPhone).toHaveBeenCalledWith("+919876543210");
  expect(calls.push).toHaveBeenCalledWith({
    pathname: "/login/verify",
    query: { next: "/app" },
  });
});

it("disables OTP sending truthfully when SMS is not configured", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhoneForm canSend={false} />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByText(messages.auth.unavailableBody, { exact: true }),
  ).toHaveTextContent(messages.auth.unavailableBody);
  expect(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  ).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9876543210{Enter}",
  );
  expect(calls.sendOtp).not.toHaveBeenCalled();
  expect(calls.rememberPhone).not.toHaveBeenCalled();
  expect(calls.push).not.toHaveBeenCalled();
});

it("validates a configured phone before sending an OTP", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhoneForm />
    </NextIntlClientProvider>,
  );
  await userEvent.type(screen.getByLabelText(messages.auth.mobileLabel), "123");
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.auth.mobileInvalid,
  );
  expect(
    screen.getByLabelText(messages.auth.mobileLabel),
  ).toHaveAccessibleDescription(messages.auth.mobileInvalid);
  expect(calls.push).not.toHaveBeenCalled();
  expect(calls.sendOtp).not.toHaveBeenCalled();
});

it("ignores a successful send after the form unmounts", async () => {
  const pending = Promise.withResolvers<{ error: null }>();
  calls.sendOtp.mockReturnValueOnce(pending.promise);
  const onSent = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhoneForm onSent={onSent} />
    </NextIntlClientProvider>,
  );
  await userEvent.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9876543210",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  view.unmount();
  await act(async () => {
    pending.resolve({ error: null });
    await pending.promise;
  });
  expect(calls.rememberPhone).not.toHaveBeenCalled();
  expect(onSent).not.toHaveBeenCalled();
  expect(calls.push).not.toHaveBeenCalled();
});
