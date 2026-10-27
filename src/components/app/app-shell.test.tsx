import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { AppShell } from "./app-shell";
import type { OrgWorkspace } from "./use-workspace";

type ShellFixture =
  | { kind: "org"; org: Pick<OrgWorkspace, "kind" | "name"> }
  | { kind: "saathi"; saathi: { name: string } }
  | { kind: "selectionRequired" }
  | null;

const state = vi.hoisted(
  (): {
    pathname: string;
    workspace: ShellFixture;
    replace: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  } => ({
    pathname: "/app",
    workspace: {
      kind: "org",
      org: { kind: "kabadiwala", name: "Test collection shop" },
    },
    replace: vi.fn(),
    signOut: vi.fn(),
  }),
);

vi.mock("@/components/notifications/device-provider", () => ({
  lockDeviceSignOut: () => vi.fn(),
  revokeCurrentDevice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./use-workspace", () => ({ useWorkspace: () => state.workspace }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { session: { id: "fixture-session" } } }),
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
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("@/components/site/language-switcher", () => ({
  LanguageSwitcher: () => <button>Language: English</button>,
}));
vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button>Appearance</button>,
}));

function view() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AppShell>
        <h1>Workspace content</h1>
      </AppShell>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  state.pathname = "/app";
  state.workspace = {
    kind: "org",
    org: { kind: "kabadiwala", name: "Test collection shop" },
  };
  state.replace.mockReset();
  state.signOut.mockReset().mockResolvedValue({ error: null });
});

describe("workspace navigation", () => {
  it.each(["kabadiwala", "yard", "recycler", "manufacturer"] as const)(
    "offers material lots in the %s workspace and mobile menu",
    async (kind) => {
      state.workspace = { kind: "org", org: { kind, name: "Test business" } };
      state.pathname = "/app/lots/test-lot";
      view();
      expect(
        screen.getByRole("link", { name: messages.lots.title }),
      ).toHaveAttribute("aria-current", "page");
      await userEvent.click(
        within(screen.getByRole("banner")).getByRole("button", {
          name: messages.app.more,
        }),
      );
      expect(
        within(screen.getByRole("dialog")).getByRole("link", {
          name: messages.lots.title,
        }),
      ).toHaveAttribute("href", "/app/lots");
    },
  );
  it.each([
    { kind: "kabadiwala", label: messages.app.nav.buy, href: "/app/market" },
    { kind: "manufacturer", label: messages.app.nav.sell, href: "/app/sell" },
  ] as const)(
    "offers the byproduct route in the $kind desktop and mobile navigation",
    async ({ kind, label, href }) => {
      state.workspace = { kind: "org", org: { kind, name: "Test business" } };
      view();
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
      await userEvent.click(
        within(screen.getByRole("banner")).getByRole("button", {
          name: messages.app.more,
        }),
      );
      expect(
        within(screen.getByRole("dialog")).getByRole("link", { name: label }),
      ).toHaveAttribute("href", href);
    },
  );

  it("identifies the parent section on desktop and mobile for a request detail", () => {
    state.pathname = "/app/requests/test-request";
    view();
    const sections = screen.getAllByRole("navigation", {
      name: messages.app.navLabel,
    });
    expect(sections).toHaveLength(2);
    for (const navigation of sections) {
      expect(
        within(navigation).getByRole("link", {
          name: messages.app.nav.requests,
        }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        within(navigation).getByRole("link", { name: messages.app.nav.home }),
      ).not.toHaveAttribute("aria-current");
    }
  });

  it("identifies the current secondary section in the mobile menu", async () => {
    state.pathname = "/app/compliance";
    view();
    await userEvent.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: messages.app.more,
      }),
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("link", {
        name: messages.app.nav.compliance,
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("keeps daily work directly visible and puts remaining routes and settings in More", async () => {
    state.workspace = {
      kind: "org",
      org: { kind: "manufacturer", name: "Test manufacturer" },
    };
    view();
    const [desktop, mobile] = screen.getAllByRole("navigation", {
      name: messages.app.navLabel,
    });
    expect(
      within(mobile)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      messages.app.nav.home,
      messages.app.nav.buy,
      messages.app.nav.trades,
      messages.app.nav.compliance,
    ]);
    expect(
      within(desktop).getByRole("link", {
        name: messages.app.nav.compliance,
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: "Language: English",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: "Appearance",
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(mobile).getByRole("button", {
        name: messages.app.more,
      }),
    );
    const menu = within(screen.getByRole("dialog"));
    for (const label of ["impact", "stock"] as const) {
      expect(
        menu.getByRole("link", { name: messages.app.nav[label] }),
      ).toBeInTheDocument();
    }
    expect(
      menu.getByRole("button", { name: "Language: English" }),
    ).toBeInTheDocument();
    expect(
      menu.getByRole("button", { name: "Appearance" }),
    ).toBeInTheDocument();
    await userEvent.click(
      menu.getByRole("button", { name: messages.app.signOut }),
    );
    expect(state.signOut).toHaveBeenCalledOnce();
    expect(state.replace).toHaveBeenCalledWith("/login");
  });

  it("closes the menu after choosing a destination", async () => {
    view();
    await userEvent.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: messages.app.more,
      }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("link", {
        name: messages.app.nav.buy,
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns keyboard focus to the trigger that opened the menu", async () => {
    view();
    const triggers = screen.getAllByRole("button", { name: messages.app.more });
    for (const trigger of triggers) {
      await userEvent.click(trigger);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    }
  });

  it("shows Saathi jobs and earnings without business trading actions", () => {
    state.workspace = {
      kind: "saathi",
      saathi: { name: "Test Saathi" },
    };
    state.pathname = "/app/impact";
    view();
    expect(
      screen.getAllByRole("link", { name: messages.app.nav.earnings }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("link", { name: messages.app.nav.buy }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: messages.app.nav.sell }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: messages.lots.title }),
    ).not.toBeInTheDocument();
  });

  it("hides business controls and offers workspace selection after access is removed", () => {
    state.workspace = { kind: "selectionRequired" };
    view();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(state.replace).toHaveBeenCalledWith("/account/workspaces");
  });

  it("keeps protected children hidden while redirecting a signed-out visitor", () => {
    state.workspace = null;
    state.pathname = "/app/stock";
    view();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(state.replace).toHaveBeenCalledWith({
      pathname: "/login",
      query: { next: "/app/stock" },
    });
  });
});

it("finds secondary operational destinations without hiding current page content", async () => {
  view();
  const search = screen.getByRole("searchbox", {
    name: messages.common.search,
  });
  await userEvent.type(search, messages.lots.title);
  expect(screen.getByRole("link", { name: messages.lots.title })).toBeVisible();
  expect(
    screen.queryByRole("link", { name: messages.app.nav.buy }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Workspace content" }),
  ).toBeVisible();
  await userEvent.clear(search);
  expect(
    screen.getByRole("link", { name: messages.app.nav.buy }),
  ).toBeVisible();
});
