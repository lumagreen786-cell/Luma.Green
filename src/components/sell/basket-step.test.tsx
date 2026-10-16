import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { BasketStep } from "./basket-step";
import type { Material } from "./types";

function withIntl(children: ReactNode) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
      onError={(error) => {
        throw error;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

const material = (
  code: string,
  family: Material["family"],
  en: string,
): Material => ({
  code,
  family,
  stage: "scrap",
  names: { en, hi: `${en} (hi)` },
  co2eFactor: 1,
});

const MATERIALS = [
  material("PAPER-NEWS", "paper", "Newspaper"),
  material("PLASTIC-PET", "plastic", "PET bottles"),
  material("METAL-IRON", "metal", "Iron and steel"),
];
const PRICES = new Map([
  ["PAPER-NEWS", 1400],
  ["PLASTIC-PET", 2000],
  ["METAL-IRON", 2800],
]);

function renderBasket(items: { materialCode: string; kg: number }[]) {
  const handlers = { onToggle: vi.fn(), onSetKg: vi.fn(), onRemove: vi.fn() };
  render(
    withIntl(
      <BasketStep
        materials={MATERIALS}
        prices={PRICES}
        items={items}
        {...handlers}
      />,
    ),
  );
  return handlers;
}

describe("BasketStep", () => {
  it("shows one material family at a time with its current prices", () => {
    renderBasket([]);
    expect(screen.getByRole("heading", { name: "Paper" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plastic" })).toBeInTheDocument();
    const tile = screen.getByRole("button", { name: /Newspaper/ });
    expect(tile).toHaveAttribute("aria-pressed", "false");
    expect(tile).toHaveTextContent("₹14/kg");
    expect(screen.getByText(messages.sell.basket.empty)).toBeInTheDocument();
  });

  it("adds a material with one tap", async () => {
    const { onToggle } = renderBasket([]);
    await userEvent.click(screen.getByRole("button", { name: "Plastic" }));
    expect(
      screen.queryByRole("button", { name: /Newspaper/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /PET bottles/ }));
    expect(onToggle).toHaveBeenCalledWith(MATERIALS[1]);
  });

  it("keeps chosen kilos and value visible when changing material family", async () => {
    renderBasket([{ materialCode: "PAPER-NEWS", kg: 12 }]);
    expect(screen.getByRole("button", { name: /^Newspaper/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Plastic" }));
    const basket = screen.getByRole("region", { name: "Your materials" });
    // 12 kg at ₹14/kg.
    expect(within(basket).getByText("About ₹168")).toBeInTheDocument();
    expect(
      within(basket).getByRole("textbox", { name: "Kilos of Newspaper" }),
    ).toHaveValue("12");
  });

  it("shows no price while prices are loading", () => {
    render(
      withIntl(
        <BasketStep
          materials={MATERIALS}
          prices={undefined}
          items={[]}
          onToggle={vi.fn()}
          onSetKg={vi.fn()}
          onRemove={vi.fn()}
        />,
      ),
    );
    expect(screen.queryByText(/\/kg/)).not.toBeInTheDocument();
  });
});
