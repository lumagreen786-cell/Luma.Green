import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { ProcessingCostSummary, RecordedCost } from "./cost-parts";

it("shows exact paise as currency and does not label a recorded zero as unknown", () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProcessingCostSummary
        consumedInputCostPaise={0}
        processingCostPaise={1}
        totalOutputCostPaise={1}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("₹0")).toBeVisible();
  expect(screen.getAllByText("₹0.01")).toHaveLength(2);
  expect(screen.queryByText(en.recordedCosts.unknown)).not.toBeInTheDocument();
});

it("labels missing cost in Arabic and retains one paisa in the locale currency format", () => {
  render(
    <NextIntlClientProvider locale="ar" messages={ar}>
      <div dir="rtl">
        <RecordedCost paise={null} />
        <RecordedCost paise={1} />
      </div>
    </NextIntlClientProvider>,
  );
  expect(screen.getByText(ar.recordedCosts.unknown)).toBeVisible();
  expect(screen.getByText(/0\.01/)).toBeVisible();
});
