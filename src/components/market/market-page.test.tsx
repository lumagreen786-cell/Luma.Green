import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarketPage } from "./market-page";
import { aListing, WithIntl } from "./test-utils";
import type { ListingView } from "./types";

const { data } = vi.hoisted(() => ({
  data: {
    kind: "yard",
    canOperate: true,
    listings: [] as unknown[],
  },
}));

/** What each query returns, by function name. */
function queryResults(): Record<string, unknown> {
  return {
    "workspace:mine": {
      kind: "org",
      org: { kind: data.kind, city: "Bengaluru" },
    },
    "catalogue:materials": [{ code: "RECYCLED-PET-FLAKE", stage: "recycled" }],
    "market:browse": data.listings,
  };
}

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => vi.fn(),
  useQuery: (query: Parameters<typeof getFunctionName>[0]) =>
    queryResults()[getFunctionName(query)],
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

function lot(id: string, code: string, name: string): ListingView {
  return aListing({
    id: id as ListingView["id"],
    material: { code, names: { en: name }, family: "paper" },
  });
}

beforeEach(() => {
  sessionStorage.clear();
  data.kind = "yard";
  data.canOperate = true;
  data.listings = [
    lot("a", "PAPER-NEWS", "Newspaper"),
    lot("b", "METAL-IRON", "Iron and steel"),
    lot("c", "PAPER-NEWS", "Newspaper"),
  ];
});

function renderPage() {
  render(
    <WithIntl>
      <MarketPage />
    </WithIntl>,
  );
}

describe("MarketPage", () => {
  it("filters the lots by material", async () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "3 lots on sale" }),
    ).toBeInTheDocument();
    const filter = screen.getByRole("group", { name: "Filter by material" });
    expect(within(filter).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(
      within(filter).getByRole("button", { name: /Iron and steel/ }),
    );
    expect(
      screen.getByRole("heading", { name: "1 lot on sale" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Iron and steel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 3, name: "Newspaper" }),
    ).not.toBeInTheDocument();

    within(filter).getByRole("button", { name: "All" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(
      screen.getByRole("heading", { name: "3 lots on sale" }),
    ).toBeInTheDocument();
    expect(within(filter).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("marks recycled material for manufacturers and lists it first", () => {
    data.kind = "manufacturer";
    data.listings = [
      lot("a", "RECYCLED-HDPE-GRANULE", "Recycled HDPE granules"),
      lot("b", "RECYCLED-PET-FLAKE", "Recycled PET flakes"),
    ];
    renderPage();
    const [first] = screen.getAllByRole("heading", { level: 3 });
    expect(first).toHaveTextContent("Recycled PET flakes");
    expect(screen.getByText("Recycled")).toBeInTheDocument();
  });

  it("shows a server-approved manufacturer byproduct to a kabadiwala", () => {
    data.kind = "kabadiwala";
    data.listings = [
      aListing({
        material: {
          code: "PAPER-OFFCUT",
          names: { en: "Paper offcuts" },
          family: "paper",
        },
        seller: {
          name: "Approved manufacturer",
          area: "Other city",
          kind: "manufacturer",
        },
        origin: "manufacturer_byproduct",
      }),
    ];
    renderPage();
    expect(
      screen.getByRole("heading", { level: 3, name: "Paper offcuts" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Buy Paper offcuts from Approved manufacturer",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Browse offers from approved suppliers for the materials you handle.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("Kabadiwalas buy from households"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Material on sale near you."),
    ).not.toBeInTheDocument();
  });

  it("keeps approved offers readable to a kabadiwala viewer without a buy action", () => {
    data.kind = "kabadiwala";
    data.canOperate = false;
    renderPage();
    expect(
      screen.getByRole("heading", { name: "3 lots on sale" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Buy / }),
    ).not.toBeInTheDocument();
  });

  it("says so when nothing is on sale", () => {
    data.listings = [];
    renderPage();
    expect(screen.getByText("Nothing on sale right now")).toBeInTheDocument();
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

it("restores the material filter after returning to the market", async () => {
  const user = userEvent.setup();
  const page = render(
    <WithIntl>
      <MarketPage />
    </WithIntl>,
  );
  await user.click(screen.getByRole("button", { name: /^Newspaper/ }));
  page.unmount();
  render(
    <WithIntl>
      <MarketPage />
    </WithIntl>,
  );
  expect(screen.getByRole("button", { name: /^Newspaper/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.queryByRole("heading", { name: "Iron and steel" }),
  ).not.toBeInTheDocument();
});
