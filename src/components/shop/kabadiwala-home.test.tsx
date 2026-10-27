import { screen, within } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import { KabadiwalaHome } from "./kabadiwala-home";
import {
  booking,
  fakeQueries,
  IRON,
  NEWSPAPER,
  PET,
  renderWithIntl,
  SHOP_WORKSPACE,
} from "./test-helpers";
import type { Payouts, RateCard, Requests, Stock } from "./types";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: { id: "fixture-user" },
        session: { id: "fixture-session", userId: "fixture-user" },
      },
      isPending: false,
      error: null,
    }),
  },
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string; query: Record<string, string> };
    children: ReactNode;
  }) => (
    <a
      href={
        typeof href === "string"
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query).toString()}`
      }
      {...props}
    >
      {children}
    </a>
  ),
}));

const REQUESTS: Requests = {
  new: [booking()],
  active: [
    booking({
      id: "active-1" as Id<"bookings">,
      name: "Meena Iyer",
      address: "5, Sampige Road, Malleshwaram, Bengaluru",
      slotWindow: "afternoon",
      status: "accepted",
    }),
  ],
  done: [],
};

const PAYOUTS: Payouts = {
  todayPaise: 25_050,
  todayCount: 1,
  weekPaise: 81_500,
  weekCount: 3,
};

const STOCK: Stock = {
  kind: "kabadiwala",
  buyerKind: "yard",
  rows: [
    {
      material: IRON,
      stage: "scrap",
      grams: 260_000,
      marketPaise: 2700,
      valuePaise: 702_000,
      costPaise: null,
      updatedAt: 0,
    },
  ],
  totalCostPaise: null,
  totalGrams: 260_000,
  totalValuePaise: 702_000,
};

const CARD: RateCard = {
  city: "Bengaluru",
  rows: [NEWSPAPER, PET, IRON].map((material, index) => ({
    material,
    myPaise: 1500 + index * 100,
    floorPaise: 1000,
    fallbackPaise: 1400,
    marketPaise: 1600,
    marketDate: "2026-09-29",
  })),
};

function renderHome(stock: Stock = STOCK) {
  vi.mocked(useMutation).mockReturnValue(
    vi.fn() as unknown as ReturnType<typeof useMutation>,
  );
  vi.mocked(useQuery).mockImplementation(
    fakeQueries({
      "workspace:mine": SHOP_WORKSPACE,
      "shop:requests": REQUESTS,
      "shop:payouts": PAYOUTS,
      "stock:mine": stock,
      "shop:rateCard": CARD,
    }) as unknown as typeof useQuery,
  );
  renderWithIntl(<KabadiwalaHome />);
}

describe("KabadiwalaHome", () => {
  it("does not show unpriced stock as a zero or complete valuation", () => {
    renderHome({
      ...STOCK,
      totalValuePaise: null,
      rows: STOCK.rows.map((row) => ({
        ...row,
        marketPaise: null,
        valuePaise: null,
      })),
    });
    expect(screen.getByText("No current offer")).toBeInTheDocument();
    expect(screen.queryByText("₹7,020")).not.toBeInTheDocument();
    expect(screen.queryByText("₹0")).not.toBeInTheDocument();
  });

  it("greets the shop and says what's waiting", () => {
    renderHome();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Ramesh Kabadi Store",
    );
    const waiting = screen.getByRole("region", { name: "New requests" });
    expect(within(waiting).getByText("1")).toBeInTheDocument();
    expect(
      within(waiting).getByText("1 household wants a pickup."),
    ).toBeInTheDocument();
    expect(
      within(waiting).getByRole("link", { name: "Requests: See requests" }),
    ).toHaveAttribute("href", "/app/requests");
    expect(
      within(waiting).getByRole("link", { name: "Requests: See requests" }),
    ).toHaveTextContent(/^Requests$/u);
  });

  it("shows the next pickup today: who, where and when", () => {
    renderHome();

    const today = screen.getByRole("region", { name: "Today's pickups" });
    const next = within(today).getByRole("link", { name: /Next/ });
    expect(next).toHaveAttribute("href", "/app/requests/active-1");
    expect(next).toHaveTextContent("Meena");
    expect(next).toHaveTextContent("Malleshwaram");
    expect(next).toHaveTextContent("Today, Afternoon");
    expect(
      within(today).getByRole("link", { name: "Today: See today's pickups" }),
    ).toHaveTextContent(/^Today$/u);
  });

  it("adds up what was paid and what the stock is worth", () => {
    renderHome();

    expect(screen.getByText("₹250.50")).toBeInTheDocument();
    expect(screen.getByText("1 pickup")).toBeInTheDocument();
    expect(screen.getByText("₹815")).toBeInTheDocument();
    expect(screen.getByText("3 pickups")).toBeInTheDocument();
    expect(screen.getByText("₹7,020")).toBeInTheDocument();
  });

  it("checks three prices against the market, most-stocked first", () => {
    renderHome();

    const check = screen.getByRole("heading", { name: "Price check" })
      .parentElement?.parentElement;
    if (!check) throw new Error("no price check section");
    const items = within(check).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Iron and steel");
    expect(items[0]).toHaveTextContent("₹17");
    expect(items[0]).toHaveTextContent("Above market");
    expect(items[1]).toHaveTextContent("Below market");
  });

  it("links to selling and to the prices", () => {
    renderHome();

    const shortcuts = screen.getByRole("navigation", { name: "Shortcuts" });
    expect(
      within(shortcuts).getByRole("link", { name: /Sell to a preprocessor/ }),
    ).toHaveAttribute("href", "/app/sell");
    expect(
      within(shortcuts).getByRole("link", { name: /My prices/ }),
    ).toHaveAttribute("href", "/app/prices");
  });
});

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => true,
}));
