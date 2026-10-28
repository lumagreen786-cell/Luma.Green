import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { FactorChallenge } from "./factor-challenge";

const mocks = vi.hoisted(() => ({
  verifyTotp: vi.fn(),
  verifyBackupCode: vi.fn(),
  verified: vi.fn(),
  restart: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { twoFactor: mocks } }));
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verifyTotp.mockResolvedValue({
    error: null,
    data: { token: "test-session" },
  });
  mocks.verifyBackupCode.mockResolvedValue({
    error: null,
    data: { token: "test-session" },
  });
});
function view() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FactorChallenge onVerified={mocks.verified} onRestart={mocks.restart} />
    </NextIntlClientProvider>,
  );
}
function enterCode() {
  fireEvent.change(screen.getByLabelText(messages.auth.codeLabel), {
    target: { value: "123456" },
  });
}

describe("authenticator challenge", () => {
  it("does not advance on an invalid code, and lets the user retry", async () => {
    const user = userEvent.setup();
    mocks.verifyTotp.mockResolvedValueOnce({
      error: { code: "INVALID_CODE", status: 401 },
    });
    view();
    enterCode();
    await user.click(
      screen.getByRole("button", { name: messages.auth.verify }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      messages.accountSecurity.errorCode,
    );
    expect(mocks.verified).not.toHaveBeenCalled();
    enterCode();
    await user.click(
      screen.getByRole("button", { name: messages.auth.verify }),
    );
    expect(mocks.verifyTotp).toHaveBeenLastCalledWith({
      code: "123456",
      trustDevice: false,
    });
    expect(mocks.verified).toHaveBeenCalledOnce();
  });

  it("provides an accessible recovery input and submits it without trusting the device", async () => {
    const user = userEvent.setup();
    view();
    await user.click(
      screen.getByRole("button", { name: messages.auth.twoFactorUseBackup }),
    );
    await user.type(
      screen.getByLabelText(messages.auth.twoFactorBackupLabel),
      "test-recovery",
    );
    await user.click(
      screen.getByRole("button", { name: messages.auth.verify }),
    );
    expect(mocks.verifyBackupCode).toHaveBeenCalledWith({
      code: "test-recovery",
      trustDevice: false,
    });
    expect(mocks.verifyTotp).not.toHaveBeenCalled();
    expect(mocks.verified).toHaveBeenCalledOnce();
  });

  it("requires a restart after challenge expiry, instead of switching to another bypass", async () => {
    const user = userEvent.setup();
    mocks.verifyTotp.mockResolvedValueOnce({
      error: { code: "INVALID_TWO_FACTOR_COOKIE", status: 401 },
    });
    view();
    enterCode();
    await user.click(
      screen.getByRole("button", { name: messages.auth.verify }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      messages.auth.twoFactorExpired,
    );
    expect(screen.getByLabelText(messages.auth.codeLabel)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: messages.auth.twoFactorUseBackup }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: messages.auth.twoFactorRestart }),
    );
    expect(mocks.restart).toHaveBeenCalledOnce();
    expect(mocks.verified).not.toHaveBeenCalled();
  });

  it("recovers from a transport failure without clearing or storing the typed code", async () => {
    const user = userEvent.setup();
    mocks.verifyTotp.mockRejectedValueOnce(new TypeError("fixture offline"));
    sessionStorage.clear();
    localStorage.clear();
    view();
    enterCode();
    await user.click(
      screen.getByRole("button", { name: messages.auth.verify }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(messages.common.error);
    expect(
      screen.getByRole("button", { name: messages.auth.verify }),
    ).toBeEnabled();
    expect(mocks.verified).not.toHaveBeenCalled();
    expect(sessionStorage).toHaveLength(0);
    expect(localStorage).toHaveLength(0);
  });
});

it.each(["totp", "backup"])(
  "ignores a late %s success after unmount",
  async (mode) => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<{ error: null }>();
    const rendered = view();
    if (mode === "backup") {
      await user.click(
        screen.getByRole("button", { name: messages.auth.twoFactorUseBackup }),
      );
      await user.type(
        screen.getByLabelText(messages.auth.twoFactorBackupLabel),
        "test-recovery",
      );
      mocks.verifyBackupCode.mockReturnValueOnce(pending.promise);
    } else {
      enterCode();
      mocks.verifyTotp.mockReturnValueOnce(pending.promise);
    }
    await user.click(
      screen.getByRole("button", { name: messages.auth.verify }),
    );
    rendered.unmount();
    await act(async () => {
      pending.resolve({ error: null });
      await pending.promise;
    });
    expect(mocks.verified).not.toHaveBeenCalled();
  },
);
