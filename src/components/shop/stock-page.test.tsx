import { screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StockPage } from "./stock-page";
import {
  fakeQueries,
  IRON,
  NEWSPAPER,
  renderWithIntl,
  SHOP_WORKSPACE,
  YARD_WORKSPACE,
} from "./test-helpers";
import type { Stock } from "./types";

const permissions = vi.hoisted(() => ({ canOperate: true }));
beforeEach(() => {
  permissions.canOperate = true;
});

vi.mock("./stock-report", () => ({ StockReport: () => null }));
vi.mock("./stock-closing", () => ({ StockClosing: () => null }));
vi.mock("./stock-intake", () => ({ StockIntake: () => null }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const IRON_ROW: Stock["rows"][number] = {
  material: IRON,
  stage: "scrap",
  grams: 260_000,
  marketPaise: 2700,
  valuePaise: 702_000,
  costPaise: null,
  updatedAt: 0,
};
const NEWSPAPER_ROW: Stock["rows"][number] = {
  material: NEWSPAPER,
  stage: "scrap",
  grams: 180_000,
  marketPaise: 1450,
  valuePaise: 261_000,
  costPaise: null,
  updatedAt: 0,
};

const SHOP_STOCK: Stock = {
  kind: "kabadiwala",
  buyerKind: "yard",
  rows: [IRON_ROW, NEWSPAPER_ROW],
  totalCostPaise: null,
  totalGrams: 440_000,
  totalValuePaise: 963_000,
};

function renderStock(stock: Stock | undefined, workspace: unknown) {
  vi.mocked(useQuery).mockImplementation(
    fakeQueries({
      "workspace:mine": workspace,
      "stock:mine": stock,
    }) as unknown as typeof useQuery,
  );
  renderWithIntl(<StockPage />);
}

describe("StockPage", () => {
  it("shows each material's weight and worth, the totals, and a way to sell", () => {
    renderStock(SHOP_STOCK, SHOP_WORKSPACE);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Stock",
    );
    expect(screen.getByText("440 kg")).toBeInTheDocument();
    expect(screen.getByText("₹9,630")).toBeInTheDocument();
    expect(screen.getByText("Iron and steel")).toBeInTheDocument();
    expect(screen.getByText("260 kg")).toBeInTheDocument();
    expect(screen.getByText("₹7,020")).toBeInTheDocument();
    expect(
      screen.getByText("Current offer value: ₹14.50/kg"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sell to a preprocessor" }),
    ).toHaveAttribute("href", "/app/sell");
  });

  it("opens manufacturer byproduct sales without inventing a next chain tier", () => {
    renderStock(
      {
        ...SHOP_STOCK,
        kind: "manufacturer",
        buyerKind: null,
        rows: SHOP_STOCK.rows.map((row) => ({ ...row, stage: "recycled" })),
      },
      SHOP_WORKSPACE,
    );
    expect(screen.getByRole("link", { name: "Sell" })).toHaveAttribute(
      "href",
      "/app/sell",
    );
  });

  it("keeps a viewer's stock read-only", () => {
    permissions.canOperate = false;
    renderStock(SHOP_STOCK, SHOP_WORKSPACE);
    expect(screen.getByText("440 kg")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /^Sell/ }),
    ).not.toBeInTheDocument();
  });

  it("splits raw scrap from recycled material when a business holds both", () => {
    renderStock(
      {
        ...SHOP_STOCK,
        kind: "recycler",
        buyerKind: "manufacturer",
        rows: [IRON_ROW, { ...NEWSPAPER_ROW, stage: "recycled" }],
      },
      YARD_WORKSPACE,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Collected materials" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Recycled material" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sell to a manufacturer" }),
    ).toBeInTheDocument();
  });

  it("shows unavailable total value when some held material has no price", () => {
    renderStock(
      {
        ...SHOP_STOCK,
        totalValuePaise: null,
        rows: [
          IRON_ROW,
          { ...NEWSPAPER_ROW, marketPaise: null, valuePaise: null },
        ],
      },
      SHOP_WORKSPACE,
    );
    expect(screen.getAllByText("No current offer")).toHaveLength(2);
    expect(screen.getByText("Current offer value")).toBeInTheDocument();
    expect(screen.queryByText("₹9,630")).not.toBeInTheDocument();
    expect(screen.getByText("₹7,020")).toBeInTheDocument();
  });

  it("says how stock arrives when there is none", () => {
    renderStock(
      { ...SHOP_STOCK, rows: [], totalGrams: 0, totalValuePaise: 0 },
      SHOP_WORKSPACE,
    );
    expect(screen.getByText("No stock yet")).toBeInTheDocument();
    expect(
      screen.getByText("Weigh and pay for a pickup, and it shows up here."),
    ).toBeInTheDocument();
  });

  it("tells a Saathi that stock is for businesses", () => {
    renderStock(undefined, {
      kind: "saathi",
      saathi: { name: "Lakshmi Devi", area: "Yeshwanthpur", city: "Bengaluru" },
    });
    expect(screen.getByText("Only for businesses")).toBeInTheDocument();
  });
});

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => permissions.canOperate,
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
