import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { AccountPhone } from "./account-phone";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  sendOtp: vi.fn(),
  refetch: vi.fn(),
  reauthenticate: vi.fn(),
  phone: true,
  verified: false,
  sessionId: "fixture-session",
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: () => ({ phone: mocks.phone }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    phoneNumber: { sendOtp: mocks.sendOtp, verify: mocks.verify },
    useSession: () => ({
      data: {
        user: { phoneNumberVerified: mocks.verified },
        session: { id: mocks.sessionId },
      },
      refetch: mocks.refetch,
    }),
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.phone = true;
  mocks.verified = false;
  mocks.sessionId = "fixture-session";
  mocks.sendOtp.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ error: null });
});
function view() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AccountPhone onReauthenticate={mocks.reauthenticate} />
    </NextIntlClientProvider>,
  );
}
async function enterCode(number = "9000000241", code = "123456") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(messages.auth.mobileLabel), number);
  await user.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  await user.type(await screen.findByLabelText(messages.auth.codeLabel), code);
  await user.click(screen.getByRole("button", { name: messages.auth.verify }));
}
it("explicitly binds to the existing session and shows verified status", async () => {
  view();
  await enterCode();
  expect(await screen.findByRole("status")).toHaveTextContent(
    messages.accountPhone.verified,
  );
  expect(mocks.verify).toHaveBeenCalledWith({
    phoneNumber: "+919000000241",
    code: "123456",
    updatePhoneNumber: true,
    disableSession: true,
  });
  expect(mocks.refetch).toHaveBeenCalledOnce();
});
it("offers explicit sign-in recovery when recent assurance expires", async () => {
  mocks.verify.mockResolvedValue({
    error: { code: "SECURITY_REAUTH_REQUIRED", status: 403 },
  });
  view();
  await enterCode();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.accountSecurity.recentSignIn,
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: messages.accountSecurity.signInAgain,
    }),
  );
  expect(mocks.reauthenticate).toHaveBeenCalledOnce();
  expect(mocks.refetch).not.toHaveBeenCalled();
});
it("retains the form and explains an occupied number without reporting success", async () => {
  mocks.verify.mockResolvedValue({
    error: { code: "PHONE_NUMBER_EXIST", status: 400 },
  });
  view();
  await enterCode();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.accountPhone.inUse,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByLabelText(messages.auth.codeLabel)).toHaveValue("");
});
it("shows unavailable delivery instead of a fake code screen", () => {
  mocks.phone = false;
  view();
  expect(screen.getByText(messages.accountPhone.unavailable)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: messages.auth.sendCode }),
  ).not.toBeInTheDocument();
});
it("handles send network failure without locking the form", async () => {
  mocks.sendOtp.mockRejectedValue(new Error("offline"));
  view();
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9000000241",
  );
  await user.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.auth.sendFailed,
  );
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: messages.auth.sendCode }),
    ).toBeEnabled();
  });
});

it("normalizes Arabic keyboard digits for both phone and code", async () => {
  view();
  await enterCode("٩٠٠٠٠٠٠٢٤١", "١٢٣٤٥٦");
  expect(await screen.findByRole("status")).toHaveTextContent(
    messages.accountPhone.verified,
  );
  expect(mocks.verify).toHaveBeenCalledWith({
    phoneNumber: "+919000000241",
    code: "123456",
    updatePhoneNumber: true,
    disableSession: true,
  });
});

it("does not refresh another session after binding completes on an unmounted form", async () => {
  const pending = Promise.withResolvers<{ error: null }>();
  mocks.verify.mockReturnValueOnce(pending.promise);
  const rendered = view();
  await enterCode();
  rendered.unmount();
  await act(async () => {
    pending.resolve({ error: null });
    await pending.promise;
  });
  expect(mocks.refetch).not.toHaveBeenCalled();
});

it("keeps a sent binding challenge when delivery is disabled", async () => {
  const user = userEvent.setup();
  const rendered = view();
  await user.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9000000241",
  );
  await user.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  mocks.phone = false;
  rendered.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AccountPhone onReauthenticate={mocks.reauthenticate} />
    </NextIntlClientProvider>,
  );
  expect(screen.getByLabelText(messages.auth.codeLabel)).toBeVisible();
  expect(
    screen.getByRole("button", { name: messages.auth.resend }),
  ).toBeDisabled();
  await user.type(screen.getByLabelText(messages.auth.codeLabel), "123456");
  await user.click(screen.getByRole("button", { name: messages.auth.verify }));
  expect(mocks.verify).toHaveBeenCalledOnce();
  expect(mocks.sendOtp).toHaveBeenCalledOnce();
});

it("does not refresh or report old binding success after a same-user session rotation", async () => {
  const pending = Promise.withResolvers<{ error: null }>();
  mocks.verify.mockReturnValueOnce(pending.promise);
  const rendered = view();
  await enterCode();
  mocks.sessionId = "rotated-session";
  rendered.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AccountPhone onReauthenticate={mocks.reauthenticate} />
    </NextIntlClientProvider>,
  );
  await act(async () => {
    pending.resolve({ error: null });
    await pending.promise;
  });
  expect(mocks.refetch).not.toHaveBeenCalled();
  expect(
    screen.queryByText(messages.accountPhone.verified),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText(messages.auth.codeLabel)).toBeVisible();
});
it("does not restore an old send result after a same-user session rotation", async () => {
  const pending = Promise.withResolvers<{ error: null }>();
  mocks.sendOtp.mockReturnValueOnce(pending.promise);
  const rendered = view();
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(messages.auth.mobileLabel),
    "9000000241",
  );
  await user.click(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  );
  mocks.sessionId = "rotated-session";
  rendered.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AccountPhone onReauthenticate={mocks.reauthenticate} />
    </NextIntlClientProvider>,
  );
  await act(async () => {
    pending.resolve({ error: null });
    await pending.promise;
  });
  expect(
    screen.queryByLabelText(messages.auth.codeLabel),
  ).not.toBeInTheDocument();
  expect(mocks.refetch).not.toHaveBeenCalled();
});
