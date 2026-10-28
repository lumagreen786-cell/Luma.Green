import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { PriceTables } from "./price-tables";

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

it("explains the missing catalogue after a city is selected without directing an operator to reset or seed data", () => {
  render(<PriceTables />);
  fireEvent.change(screen.getByRole("textbox", { name: "City or locality" }), {
    target: { value: "Bengaluru" },
  });
  expect(screen.getByText("No materials yet")).toBeVisible();
  expect(
    screen.getByText(
      "Add the catalogue definitions below, then set approved prices. No sample rates or stock will be created.",
    ),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Add catalogue definitions" }),
  ).toBeVisible();
  expect(screen.queryByText(/demo seed|reset/i)).not.toBeInTheDocument();
});

it("asks for a locality before showing city-scoped price or missing-catalogue results", () => {
  render(<PriceTables />);
  expect(screen.getByRole("textbox", { name: "City or locality" })).toHaveValue(
    "",
  );
  expect(
    screen.getByText("Select a city to manage its dated indicative prices."),
  ).toBeVisible();
  expect(screen.queryByText("No materials yet")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Add catalogue definitions" }),
  ).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "City or locality" }), {
    target: { value: "Bengaluru" },
  });
  expect(screen.getByText("No materials yet")).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "City or locality" }), {
    target: { value: "" },
  });
  expect(screen.queryByText("No materials yet")).not.toBeInTheDocument();
});
