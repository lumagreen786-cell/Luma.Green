import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { EmailForm } from "./email-form";
import { EmailTokenForm } from "./email-token-form";

const calls = vi.hoisted(() => ({
  signin: vi.fn(),
  signup: vi.fn(),
  forgot: vi.fn(),
  verify: vi.fn(),
  resend: vi.fn(),
  reset: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: calls.signin },
    signUp: { email: calls.signup },
    requestPasswordReset: calls.forgot,
    sendVerificationEmail: calls.resend,
    verifyEmail: calls.verify,
    resetPassword: calls.reset,
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: "a",
  useRouter: () => ({ replace: calls.replace }),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => calls.params }));
vi.mock("./factor-challenge", () => ({
  FactorChallenge: () => <p>Second factor fixture</p>,
}));
beforeEach(() => {
  vi.resetAllMocks();
  calls.params = new URLSearchParams("next=/app");
});
function view(node: React.ReactNode = <EmailForm canSend />) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}
async function credentials() {
  await userEvent.type(
    screen.getByLabelText(messages.emailAuth.email),
    "member@example.test",
  );
  await userEvent.type(
    screen.getByLabelText(messages.emailAuth.password, { exact: true }),
    "Disposable-password-123",
  );
}
it("retains credentials after failure and waits for the second factor before navigation", async () => {
  calls.signin
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ data: { twoFactorRedirect: true } });
  view();
  await credentials();
  await userEvent.click(
    screen.getByRole("button", {
      name: messages.emailAuth.signin,
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.emailAuth.failed,
  );
  expect(screen.getByLabelText(messages.emailAuth.email)).toHaveValue(
    "member@example.test",
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: messages.emailAuth.signin,
    }),
  );
  expect(screen.getByText("Second factor fixture")).toBeVisible();
  expect(calls.replace).not.toHaveBeenCalled();
});
it("creates an unverified account and asks for mailbox verification without navigating", async () => {
  calls.signup.mockResolvedValue({ data: { token: null }, error: null });
  view();
  await userEvent.click(
    screen.getByRole("button", { name: messages.emailAuth.signup }),
  );
  expect(screen.getByText(messages.collectionPrivacy.email)).toBeVisible();
  expect(
    screen.getByRole("link", { name: messages.privacy.title }),
  ).toHaveAttribute("href", "/privacy");
  expect(calls.signup).not.toHaveBeenCalled();
  await userEvent.type(
    screen.getByLabelText(messages.emailAuth.name),
    "Disposable Member",
  );
  await credentials();
  expect(
    screen.getByRole("button", { name: messages.emailAuth.signup }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole("checkbox", { name: messages.join.consent.age }),
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: messages.emailAuth.signup,
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    messages.emailAuth.sent,
  );
  expect(calls.replace).not.toHaveBeenCalled();
});
it("offers verification resend for an unverified account", async () => {
  calls.signin.mockResolvedValue({
    error: { code: "EMAIL_NOT_VERIFIED", status: 403 },
  });
  calls.resend.mockResolvedValue({ error: null });
  view();
  await credentials();
  await userEvent.click(
    screen.getByRole("button", {
      name: messages.emailAuth.signin,
    }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.emailAuth.resend }),
  );
  expect(calls.resend).toHaveBeenCalledWith({
    email: "member@example.test",
    fetchOptions: { headers: { "x-luma-locale": "en" } },
  });
  expect(screen.getByRole("status")).toHaveTextContent(messages.emailAuth.sent);
});
it("shows delivery unavailable and disables signup submission", async () => {
  view(<EmailForm canSend={false} />);
  expect(screen.getByRole("status")).toHaveTextContent(
    messages.emailAuth.unavailable,
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.emailAuth.signup }),
  );
  expect(
    screen.getByRole("button", {
      name: messages.emailAuth.signup,
    }),
  ).toBeDisabled();
  expect(calls.signup).not.toHaveBeenCalled();
});
it("removes a verification token from the URL and only verifies on explicit submit", async () => {
  calls.params = new URLSearchParams("token=disposable-token");
  calls.verify.mockResolvedValue({ error: null });
  const replace = vi.spyOn(window.history, "replaceState");
  view(<EmailTokenForm />);
  expect(replace).toHaveBeenCalledWith(null, "", window.location.pathname);
  expect(calls.verify).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: messages.emailAuth.verify }),
  );
  expect(calls.verify).toHaveBeenCalledWith({
    query: { token: "disposable-token" },
  });
  expect(screen.getByRole("status")).toHaveTextContent(messages.emailAuth.done);
  replace.mockRestore();
});
it("rejects mismatched new passwords before sending a reset", async () => {
  calls.params = new URLSearchParams("token=disposable-token");
  view(<EmailTokenForm reset />);
  await userEvent.type(
    screen.getByLabelText(messages.emailAuth.password, { exact: true }),
    "New-disposable-password",
  );
  await userEvent.type(
    screen.getByLabelText(messages.emailAuth.confirm),
    "Another-disposable-password",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.emailAuth.reset }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.emailAuth.mismatch,
  );
  expect(calls.reset).not.toHaveBeenCalled();
});

it("keeps a failed reset usable and completes a retry without signing in", async () => {
  calls.params = new URLSearchParams("token=disposable-token");
  calls.reset
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ error: null });
  view(<EmailTokenForm reset />);
  for (const label of [
    messages.emailAuth.password,
    messages.emailAuth.confirm,
  ]) {
    await userEvent.type(
      screen.getByLabelText(label, { exact: true }),
      "New-disposable-password",
    );
  }
  await userEvent.click(
    screen.getByRole("button", { name: messages.emailAuth.reset }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.emailAuth.failed,
  );
  expect(
    screen.getByLabelText(messages.emailAuth.password, { exact: true }),
  ).toHaveValue("New-disposable-password");
  await userEvent.click(
    screen.getByRole("button", { name: messages.emailAuth.reset }),
  );
  expect(calls.reset).toHaveBeenLastCalledWith({
    token: "disposable-token",
    newPassword: "New-disposable-password",
  });
  expect(screen.getByRole("status")).toHaveTextContent(messages.emailAuth.done);
  expect(calls.replace).not.toHaveBeenCalled();
});

it("shows an expired link error without a success claim", async () => {
  calls.params = new URLSearchParams("token=disposable-token");
  calls.verify.mockResolvedValue({
    error: { code: "TOKEN_EXPIRED", status: 401 },
  });
  view(<EmailTokenForm />);
  await userEvent.click(
    screen.getByRole("button", { name: messages.emailAuth.verify }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.emailAuth.invalidLink,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("lets the keyboard show and hide the entered password without submitting", async () => {
  const user = userEvent.setup();
  view();
  const password = screen.getByLabelText(messages.emailAuth.password, {
    exact: true,
  });
  await user.type(password, "Disposable-password-123");
  const show = screen.getByRole("button", { name: messages.emailAuth.show });
  show.focus();
  await user.keyboard("{Enter}");
  expect(password).toHaveAttribute("type", "text");
  const hide = screen.getByRole("button", { name: messages.emailAuth.hide });
  expect(hide).toHaveAttribute("aria-pressed", "true");
  expect(hide).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(password).toHaveAttribute("type", "password");
  expect(password).toHaveValue("Disposable-password-123");
  expect(calls.signin).not.toHaveBeenCalled();
});
