import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { SavingsChart } from "./savings-chart";

for (const [locale, messages] of [
  ["en", en],
  ["ar", ar],
] as const) {
  describe(`solar savings in ${locale}`, () => {
    it("exposes every year by keyboard and in the data table", async () => {
      const user = userEvent.setup();
      render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SavingsChart
            savingsByYear={[
              { year: 1, saved: 12_000 },
              { year: 2, saved: 24_000 },
              { year: 3, saved: 36_000 },
            ]}
            netCost={{ low: 20_000, high: 30_000 }}
          />
        </NextIntlClientProvider>,
      );
      await user.tab();
      const chart = screen.getByRole("slider");
      expect(chart).toHaveFocus();
      await user.keyboard("{Home}");
      expect(chart).toHaveValue(1);
      await user.keyboard("{ArrowRight}");
      expect(chart).toHaveValue(2);
      await user.keyboard("{End}");
      expect(chart).toHaveValue(3);
      await user.click(screen.getByText(messages.solar.chart.table));
      const table = screen.getByRole("table");
      expect(within(table).getAllByRole("row")).toHaveLength(4);
      expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
    });
  });
}

it("keeps chart labels and hatch references local to each instance", () => {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={en}>
      {[1, 2].map((key) => (
        <SavingsChart
          key={key}
          savingsByYear={[
            { year: 1, saved: 12_000 },
            { year: 2, saved: 24_000 },
          ]}
          netCost={{ low: 20_000, high: 30_000 }}
        />
      ))}
    </NextIntlClientProvider>,
  );
  const figures = [...container.querySelectorAll("figure")];
  const ids = figures.map((figure) => {
    const pattern = figure.querySelector("pattern");
    expect(pattern).not.toBeNull();
    const id = pattern?.id ?? "";
    expect(id).not.toBe("");
    expect(
      [...figure.querySelectorAll("path")].some(
        (path) => path.getAttribute("fill") === `url(#${id})`,
      ),
    ).toBe(true);
    expect(
      [...figure.querySelectorAll("[id]")].some(
        (element) => element.id === figure.getAttribute("aria-labelledby"),
      ),
    ).toBe(true);
    return id;
  });
  expect(new Set(ids).size).toBe(2);
});
