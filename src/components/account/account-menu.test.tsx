import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { AccountMenu } from "./account-menu";

const state = vi.hoisted(() => ({
  signedIn: true,
  configured: true,
  useSession: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("@/components/notifications/device-provider", () => ({
  lockDeviceSignOut: () => vi.fn(),
  revokeCurrentDevice: state.revoke,
}));
vi.mock("@/components/providers/convex-provider", () => ({
  get isConvexConfigured() {
    return state.configured;
  },
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: state.useSession,
    signOut: state.signOut,
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (props: ComponentProps<"a">) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        props.onClick?.(event);
      }}
    />
  ),
  usePathname: () => "/account/security",
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("@/components/site/language-switcher", () => ({
  LanguageSwitcher: () => <button>Language control</button>,
}));
vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button>Theme control</button>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.signedIn = true;
  state.configured = true;
  state.useSession.mockImplementation(() => ({
    data: state.signedIn
      ? { user: {}, session: { id: "fixture-session" } }
      : null,
  }));
  state.signOut.mockResolvedValue({ error: null });
  state.revoke.mockResolvedValue(undefined);
});

it.each([
  { locale: "en", messages: en, side: "right" },
  { locale: "ar", messages: ar, side: "left" },
])(
  "keeps settings in an accessible $locale menu with locale-aware destinations",
  async ({ locale, messages, side }) => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AccountMenu />
      </NextIntlClientProvider>,
    );
    const trigger = screen.getByRole("button", { name: messages.nav.openMenu });
    expect(
      screen.queryByRole("button", { name: "Language control" }),
    ).not.toBeInTheDocument();
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-side", side);
    expect(
      within(dialog).getByRole("link", {
        name: messages.accountSecurity.title,
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(dialog).getByRole("link", { name: messages.notifications.title }),
    ).toHaveAttribute("href", "/account/notifications");
    expect(
      within(dialog).getByRole("button", { name: "Language control" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  },
);

it("closes on a destination and signs out only after device revocation", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AccountMenu />
    </NextIntlClientProvider>,
  );
  const open = () =>
    userEvent.click(screen.getByRole("button", { name: en.nav.openMenu }));
  await open();
  await userEvent.click(
    screen.getByRole("link", { name: en.notifications.title }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await open();
  await userEvent.click(screen.getByRole("button", { name: en.app.signOut }));
  expect(state.revoke.mock.invocationCallOrder[0]).toBeLessThan(
    state.signOut.mock.invocationCallOrder[0],
  );
  expect(state.replace).toHaveBeenCalledWith("/login");
});

it("offers sign-in instead of sign-out for a public tracking visitor", async () => {
  state.signedIn = false;
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AccountMenu />
    </NextIntlClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: en.nav.openMenu }));
  expect(screen.getByRole("link", { name: en.auth.metaTitle })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(
    screen.queryByRole("button", { name: en.app.signOut }),
  ).not.toBeInTheDocument();
});

it("does not read an auth session when opening the disconnected menu", async () => {
  state.configured = false;
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AccountMenu />
    </NextIntlClientProvider>,
  );
  expect(state.useSession).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: en.nav.openMenu }));
  const signIn = screen.getByRole("link", { name: en.auth.metaTitle });
  expect(signIn).toHaveAttribute("href", "/login");
  expect(
    screen.getByRole("button", { name: "Language control" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Theme control" }),
  ).not.toBeInTheDocument();
  await userEvent.click(signIn);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(state.useSession).not.toHaveBeenCalled();
  expect(state.signOut).not.toHaveBeenCalled();
  expect(state.revoke).not.toHaveBeenCalled();
});
