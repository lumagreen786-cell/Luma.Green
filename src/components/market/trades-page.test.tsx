import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aTrade, WithIntl } from "./test-utils";
import { TradesPage } from "./trades-page";
import type { TradeView } from "./types";

const { data } = vi.hoisted(() => ({
  data: {
    kind: "yard",
    tab: null as string | null,
    trades: { buying: [] as unknown[], selling: [] as unknown[] },
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => vi.fn(),
  useQuery: (query: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(query)) {
      case "workspace:mine": {
        return { kind: "org", org: { kind: data.kind } };
      }
      case "market:trades": {
        return data.trades;
      }
      case "cashfreeLifecycle:status": {
        // These tab fixtures predate verified financial records.
        return null;
      }
      default: {
        throw new Error("Unexpected trade page query");
      }
    }
  },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(data.tab === null ? "" : `tab=${data.tab}`),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const bought = aTrade({
  id: "bought" as TradeView["id"],
  material: { code: "PAPER-NEWS", names: { en: "Newspaper" }, family: "paper" },
  counterparty: {
    name: "Ramesh Kabadi Store",
    area: "Yeshwanthpur",
    kind: "kabadiwala",
  },
  status: "accepted",
  actions: ["pay"],
});
const sold = aTrade({
  id: "sold" as TradeView["id"],
  material: {
    code: "PLASTIC-PET",
    names: { en: "PET bottles" },
    family: "plastic",
  },
  counterparty: {
    name: "GreenLoop Polymers",
    area: "Bommasandra",
    kind: "recycler",
  },
  status: "dispatched",
});

beforeEach(() => {
  sessionStorage.clear();
  data.kind = "yard";
  data.tab = null;
  data.trades = { buying: [bought], selling: [sold] };
});

function renderPage(locale = "en") {
  render(
    <WithIntl locale={locale}>
      <TradesPage />
    </WithIntl>,
  );
}

describe("TradesPage", () => {
  it.each(["ar", "ur"])(
    "keeps %s trade tabs and selected content in the locale direction",
    async (locale) => {
      const user = userEvent.setup();
      data.trades = { buying: [], selling: [] };
      renderPage(locale);
      const buying = screen.getByRole("tab", { name: "Buying" });
      const selling = screen.getByRole("tab", { name: "Selling" });
      expect(buying.closest("[dir]")).toHaveAttribute("dir", "rtl");
      await user.click(buying);
      await user.keyboard("{ArrowLeft}");
      await waitFor(() => expect(selling).toHaveFocus());
      expect(selling).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel").closest("[dir]")).toHaveAttribute(
        "dir",
        "rtl",
      );
      expect(screen.getByText("No sales yet")).toBeVisible();
      await user.keyboard("{ArrowRight}");
      await waitFor(() => expect(buying).toHaveFocus());
      expect(buying).toHaveAttribute("aria-selected", "true");
    },
  );

  it("gives yards Buying and Selling tabs, opening where they're needed", async () => {
    renderPage();
    const buying = screen.getByRole("tab", { name: /Buying/ });
    expect(buying).toHaveAttribute("aria-selected", "true");
    expect(buying).not.toHaveTextContent("needs you");
    expect(
      screen.getByRole("heading", { name: "Newspaper · 100 kg" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Selling/ }));
    expect(
      screen.getByRole("heading", { name: "PET bottles · 100 kg" }),
    ).toBeInTheDocument();
  });

  it("opens the tab a link asks for", () => {
    data.tab = "selling";
    renderPage();
    expect(screen.getByRole("tab", { name: /Selling/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it.each(["kabadiwala", "manufacturer"])(
    "keeps both trade directions visible for %s byproduct trades",
    async (kind) => {
      data.kind = kind;
      renderPage();
      expect(screen.getByRole("tab", { name: /Buying/ })).toBeVisible();
      expect(
        screen.getByRole("tab", {
          name: kind === "kabadiwala" ? /Selling/ : /Buying/,
        }),
      ).toHaveAttribute("aria-selected", "true");
      await userEvent.click(screen.getByRole("tab", { name: /Buying/ }));
      expect(
        screen.getByRole("heading", { name: "Newspaper · 100 kg" }),
      ).toBeVisible();
      await userEvent.click(screen.getByRole("tab", { name: /Selling/ }));
      expect(
        screen.getByRole("heading", { name: "PET bottles · 100 kg" }),
      ).toBeVisible();
    },
  );
});

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => true,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      isPending: false,
      error: null,
      data: {
        user: { id: "fixture-user" },
        session: { id: "fixture-session" },
      },
    }),
  },
}));

it("follows a new explicit trade tab on the same mounted page", async () => {
  const user = userEvent.setup();
  const page = render(
    <WithIntl>
      <TradesPage />
    </WithIntl>,
  );
  await user.click(screen.getByRole("tab", { name: /Selling/ }));
  data.tab = "buying";
  page.rerender(
    <WithIntl>
      <TradesPage />
    </WithIntl>,
  );
  expect(screen.getByRole("tab", { name: /Buying/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
