import { render, screen, within } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BusinessHome } from "./business-home";
import { aListing, aTrade, WithIntl } from "./test-utils";
import type { ListingView, TradeView } from "./types";

const { data } = vi.hoisted(() => ({
  data: {
    kind: "yard",
    canOperate: true,
    trades: { buying: [] as unknown[], selling: [] as unknown[] },
    offers: [] as unknown[],
    mine: [] as unknown[],
  },
}));

/** What each query returns, by function name. */
function queryResults(): Record<string, unknown> {
  return {
    "workspace:mine": {
      kind: "org",
      org: { kind: data.kind, name: "Peenya Paper & Plastic Yard" },
    },
    "market:trades": data.trades,
    "market:browse": data.offers,
    "market:myListings": data.mine,
    "catalogue:materials": [{ code: "RECYCLED-PET-FLAKE", stage: "recycled" }],
  };
}

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => vi.fn(),
  useQuery: (query: Parameters<typeof getFunctionName>[0], args?: unknown) =>
    args === "skip" ? undefined : queryResults()[getFunctionName(query)],
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  data.kind = "yard";
  data.canOperate = true;
  data.trades = {
    buying: [
      aTrade({
        id: "pay-me" as TradeView["id"],
        status: "accepted",
        actions: ["pay"],
        totalPaise: 175_000,
      }),
    ],
    selling: [
      aTrade({
        id: "decide" as TradeView["id"],
        status: "requested",
        actions: ["accept", "decline"],
      }),
      aTrade({
        id: "held" as TradeView["id"],
        status: "dispatched",
        inEscrow: true,
        totalPaise: 7_600_000,
      }),
      aTrade({
        id: "done" as TradeView["id"],
        status: "completed",
        totalPaise: 2_000_000,
      }),
    ],
  };
  data.offers = [aListing()];
  data.mine = [
    aListing({
      id: "open" as ListingView["id"],
      isMine: true,
      grams: 5_000_000,
    }),
    aListing({ id: "sold" as ListingView["id"], status: "sold", grams: 0 }),
  ];
});

function renderHome() {
  render(
    <WithIntl>
      <BusinessHome />
    </WithIntl>,
  );
}

describe("BusinessHome", () => {
  it("greets the business and adds up its trades", () => {
    renderHome();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Namaste, Peenya Paper & Plastic Yard",
      }),
    ).toBeInTheDocument();
    const stats = screen.getByRole("region", { name: "At a glance" });
    expect(within(stats).getByText("Accepted orders")).toBeInTheDocument();
    expect(within(stats).getAllByText("1")).toHaveLength(3);
    expect(within(stats).getByText("1 trade needs a step")).toBeInTheDocument();
    expect(within(stats).getByText("5,000 kg listed")).toBeInTheDocument();
    expect(within(stats).queryByText("₹76,000")).not.toBeInTheDocument();
  });

  it("places work waiting for a decision before summary figures", () => {
    renderHome();
    const waiting = screen.getByRole("heading", { name: "Waiting for you" });
    const stats = screen.getByRole("region", { name: "At a glance" });
    expect(
      waiting.compareDocumentPosition(stats) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("offers only order decisions and no simulated payment action", () => {
    renderHome();
    expect(
      screen.getByRole("button", { name: "Accept order" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pay/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sell/ })).toHaveAttribute(
      "href",
      "/app/sell",
    );
  });

  it("shows manufacturers recycled offers and a way to manage byproduct sales", () => {
    data.kind = "manufacturer";
    data.offers = [
      aListing({
        material: {
          code: "RECYCLED-PET-FLAKE",
          names: { en: "Recycled PET flakes" },
          family: "plastic",
        },
      }),
    ];
    renderHome();
    expect(
      screen.getByRole("heading", { name: "Material offers for you" }),
    ).toBeInTheDocument();
    expect(screen.getByText("5,000 kg listed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sell" })).toHaveAttribute(
      "href",
      "/app/sell",
    );
  });
  it("hides manufacturer order and sale actions for a viewer", () => {
    data.kind = "manufacturer";
    data.canOperate = false;
    renderHome();
    expect(
      screen.queryByRole("link", { name: "Sell" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept order" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("5,000 kg listed")).toBeVisible();
  });
});

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => data.canOperate,
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
