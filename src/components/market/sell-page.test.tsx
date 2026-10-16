import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { SellPage } from "./sell-page";
import { aListing, WithIntl } from "./test-utils";

const state = vi.hoisted(() => ({ canOperate: true }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => vi.fn(),
  useQuery: (query: Parameters<typeof getFunctionName>[0]) => {
    const results: Record<string, unknown> = {
      "workspace:mine": {
        kind: "org",
        org: { kind: "manufacturer", city: "Bengaluru" },
      },
      "market:myListings": [
        aListing({ isMine: true, origin: "manufacturer_byproduct" }),
      ],
      "market:sellable": [
        {
          material: {
            code: "PAPER-OFFCUT",
            names: { en: "Paper offcuts" },
            family: "paper",
          },
          stage: "scrap",
          stockGrams: 2000,
          availableGrams: 2000,
        },
      ],
      "catalogue:priceQuotes": { rows: [] },
    };
    return results[getFunctionName(query)];
  },
}));
vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => state.canOperate,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
beforeEach(() => {
  state.canOperate = true;
});

it("lets a manufacturer choose server-approved byproducts and manage its offers", async () => {
  render(
    <WithIntl>
      <SellPage />
    </WithIntl>,
  );
  expect(screen.getByRole("heading", { name: "Newspaper" })).toBeVisible();
  await userEvent.click(screen.getByRole("tab", { name: "New listing" }));
  expect(screen.getByRole("radio", { name: /Paper offcuts/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "Put on sale" })).toBeVisible();
  await userEvent.click(screen.getByRole("tab", { name: "On sale now" }));
  expect(screen.getByRole("heading", { name: "Newspaper" })).toBeVisible();
  expect(screen.queryByText("Manufacturers buy here")).not.toBeInTheDocument();
});

it("lets a manufacturer viewer read offers without listing or withdrawal controls", () => {
  state.canOperate = false;
  render(
    <WithIntl>
      <SellPage />
    </WithIntl>,
  );
  expect(screen.getByRole("heading", { name: "Newspaper" })).toBeVisible();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

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
