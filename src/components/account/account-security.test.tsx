import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { AccountSecurity } from "./account-security";

const mocks = vi.hoisted(() => ({
  session: {
    data: { session: { id: "fixture-session" }, user: { id: "fixture-user" } },
  },
  useSession: vi.fn(),
  identity: vi.fn(),
  auth: vi.fn(),
  enable: vi.fn(),
  verifyTotp: vi.fn(),
  generateBackupCodes: vi.fn(),
  disable: vi.fn(),
  signOut: vi.fn(),
  revoke: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: mocks.auth,
  useQuery: mocks.identity,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () =>
      mocks.useSession() as typeof mocks.session | { data: null },
    twoFactor: mocks,
    signOut: mocks.signOut,
  },
}));
vi.mock("@/components/notifications/device-provider", () => ({
  lockDeviceSignOut: () => vi.fn(),
  revokeCurrentDevice: mocks.revoke,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: "a",
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: () => Promise.resolve("") },
}));

const sequence = { session: 0 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.data = {
    session: { id: `fixture-session-${String(++sequence.session)}` },
    user: { id: "fixture-user" },
  };
  mocks.useSession.mockImplementation(() => mocks.session);
  mocks.auth.mockReturnValue({ isLoading: false, isAuthenticated: true });
  mocks.identity.mockReturnValue({ kind: "member", twoFactorEnabled: false });
  mocks.enable.mockResolvedValue({
    error: null,
    data: {
      totpURI: "otpauth://totp/Test?secret=TESTONLY",
      backupCodes: ["fixture-code"],
    },
  });
  mocks.verifyTotp.mockResolvedValue({
    error: null,
    data: { token: "fixture-session" },
  });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.revoke.mockResolvedValue(undefined);
});
function view() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AccountSecurity />
    </NextIntlClientProvider>,
  );
}

describe("account security", () => {
  it("allows phone-only household identities to enroll and only reveals recovery codes after verification", async () => {
    const user = userEvent.setup();
    view();
    expect(
      screen.getByText(messages.accountSecurity.disabled),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: messages.accountSecurity.enable }),
    );
    expect(screen.queryByText("fixture-code")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(messages.auth.codeLabel), {
      target: { value: "123456" },
    });
    await user.click(
      screen.getByRole("button", { name: messages.auth.verify }),
    );
    expect(screen.getByText("fixture-code")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: messages.accountSecurity.savedCodes }),
    );
    expect(screen.queryByText("fixture-code")).not.toBeInTheDocument();
  });

  it("handles recent-auth rejection and does not sign out until device revocation succeeds", async () => {
    const user = userEvent.setup();
    mocks.enable.mockResolvedValue({
      error: { code: "SECURITY_REAUTH_REQUIRED", status: 403 },
    });
    mocks.revoke.mockRejectedValueOnce(new Error("fixture offline"));
    view();
    await user.click(
      screen.getByRole("button", { name: messages.accountSecurity.enable }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      messages.accountSecurity.recentSignIn,
    );
    await user.click(
      screen.getByRole("button", {
        name: messages.accountSecurity.signInAgain,
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(messages.common.error);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: messages.accountSecurity.enable }),
    );
    await user.click(
      screen.getByRole("button", {
        name: messages.accountSecurity.signInAgain,
      }),
    );
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: "/login",
      query: { next: "/account/security" },
    });
  });

  it("requires a confirmation before disabling and surfaces a failed response", async () => {
    const user = userEvent.setup();
    mocks.identity.mockReturnValue({ kind: "member", twoFactorEnabled: true });
    mocks.disable.mockResolvedValue({ error: { status: 503 } });
    view();
    await user.click(
      screen.getByRole("button", { name: messages.accountSecurity.disable }),
    );
    expect(mocks.disable).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      messages.accountSecurity.disableDescription,
    );
    const buttons = screen.getAllByRole("button", {
      name: messages.accountSecurity.disable,
    });
    const confirm = buttons.at(-1);
    if (!confirm) throw new Error("Missing confirmation");
    await user.click(confirm);
    expect(mocks.disable).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(messages.common.error);
  });

  it("does not leave an expired session on an endless skeleton", () => {
    mocks.session.data = { session: { id: "" }, user: { id: "" } };
    mocks.useSession.mockReturnValue({ data: null });
    mocks.auth.mockReturnValue({ isLoading: false, isAuthenticated: false });
    mocks.identity.mockReturnValue(undefined);
    view();
    expect(
      screen.getByRole("link", { name: messages.accountSecurity.signInAgain }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: messages.accountSecurity.enable }),
    ).not.toBeInTheDocument();
  });
});

it("sends the current password when an email account enrolls its authenticator", async () => {
  mocks.identity.mockReturnValue({
    kind: "member",
    twoFactorEnabled: false,
    hasPassword: true,
  });
  view();
  await userEvent.type(
    screen.getByLabelText(messages.emailAuth.password),
    "Disposable-password-123",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.accountSecurity.enable }),
  );
  expect(mocks.enable).toHaveBeenCalledWith({
    password: "Disposable-password-123",
  });
});

it("asks for an email password only inside the selected protection change", async () => {
  mocks.identity.mockReturnValue({
    kind: "member",
    twoFactorEnabled: true,
    hasPassword: true,
  });
  mocks.disable.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  view();
  expect(
    screen.queryByLabelText(messages.emailAuth.password),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText(messages.emailAuth.securityHint)).toHaveLength(1);
  await user.click(
    screen.getByRole("button", { name: messages.accountSecurity.disable }),
  );
  const dialog = screen.getByRole("dialog");
  const password = within(dialog).getByLabelText(messages.emailAuth.password);
  expect(screen.getAllByLabelText(messages.emailAuth.password)).toHaveLength(1);
  await user.type(password, "Disposable-password-123");
  await user.click(
    within(dialog).getByRole("button", {
      name: messages.accountSecurity.disable,
    }),
  );
  expect(mocks.disable).toHaveBeenCalledWith({
    password: "Disposable-password-123",
  });
});

it("does not show an unused password field for the fixed admin factor policy", () => {
  mocks.identity.mockReturnValue({
    kind: "admin",
    twoFactorEnabled: true,
    hasPassword: true,
  });
  view();
  expect(
    screen.queryByLabelText(messages.emailAuth.password),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: messages.accountSecurity.disable }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(messages.emailAuth.securityHint)).toBeVisible();
  expect(
    screen.getByRole("link", { name: messages.nav.contact }),
  ).toBeVisible();
});

it("preserves revealed recovery codes on same-user session rotation and clears them for a different user", async () => {
  const rendered = view();
  await userEvent.click(
    screen.getByRole("button", { name: messages.accountSecurity.enable }),
  );
  fireEvent.change(screen.getByLabelText(messages.auth.codeLabel), {
    target: { value: "123456" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.verify }),
  );
  expect(screen.getByText("fixture-code")).toBeVisible();
  mocks.session.data = {
    session: { id: "rotated-session" },
    user: { id: "fixture-user" },
  };
  rendered.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AccountSecurity />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("fixture-code")).toBeVisible();
  mocks.session.data = {
    session: { id: "other-session" },
    user: { id: "other-user" },
  };
  rendered.rerender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AccountSecurity />
    </NextIntlClientProvider>,
  );
  expect(screen.queryByText("fixture-code")).not.toBeInTheDocument();
});

it("does not dispatch logout or navigate after reauthentication leaves its screen", async () => {
  const pending = Promise.withResolvers<undefined>();
  mocks.revoke.mockReturnValueOnce(pending.promise);
  mocks.enable.mockResolvedValueOnce({
    error: { code: "SECURITY_REAUTH_REQUIRED" },
  });
  const user = userEvent.setup();
  const rendered = view();
  await user.click(
    screen.getByRole("button", { name: messages.accountSecurity.enable }),
  );
  await user.click(
    screen.getByRole("button", { name: messages.accountSecurity.signInAgain }),
  );
  rendered.unmount();
  await act(async () => {
    pending.resolve(undefined);
    await pending.promise;
  });
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});
