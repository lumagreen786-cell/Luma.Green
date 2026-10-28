import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import messages from "../../../messages/en.json";
import { ListingCard } from "./listing-card";
import { aListing, WithIntl } from "./test-utils";

it("keeps a legacy listing visible when its total cannot be represented exactly", () => {
  render(
    <WithIntl>
      <ListingCard
        listing={aListing({ askPaisePerKg: Number.MAX_SAFE_INTEGER })}
      />
    </WithIntl>,
  );
  expect(
    screen.getByRole("heading", { name: "Newspaper" }),
  ).toBeInTheDocument();
  expect(screen.getByText(messages.market.totalInvalid)).toBeInTheDocument();
});

it("shows expired offers as unavailable and removes the buying action", () => {
  render(
    <WithIntl>
      <ListingCard
        listing={aListing({ expiresAt: Date.now() - 1 })}
        action={<button>Buy expired offer</button>}
      />
    </WithIntl>,
  );
  expect(screen.getAllByText(messages.shop.stock.noPrice)).toHaveLength(2);
  expect(screen.queryByText("₹17.50/kg")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Buy expired offer" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/^Expires /)).toBeInTheDocument();
});
