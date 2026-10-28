import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { BusinessJourney } from "./business-journey";
import type { Application } from "./use-mine";

const business = {
  city: "Bengaluru",
  businessName: "Example yard",
  gstRegistered: true,
  gstin: "29ABCDE1234F1Z5",
  materials: ["paper"],
  address: "Example street",
  collectsFromSuppliers: false,
  phones: [],
  opens: "09:00",
  closes: "18:00",
  weeklyOff: [],
  locationTags: [],
};
vi.mock("./business-form", () => ({
  BusinessForm: ({
    onContinue,
  }: {
    onContinue: (draft: typeof business) => void;
  }) => (
    <div>
      <input aria-label="Business draft" defaultValue="" />
      <button
        type="button"
        onClick={() => {
          onContinue(business);
        }}
      >
        Continue to documents
      </button>
    </div>
  ),
}));
vi.mock("./documents-form", () => ({
  DocumentsForm: ({ onBack }: { onBack: () => void }) => (
    <div>
      <input aria-label="Document draft" defaultValue="" />
      <button type="button" onClick={onBack}>
        Back to business
      </button>
    </div>
  ),
}));

it("keeps both form drafts when moving between business details and documents on one route", () => {
  render(
    <BusinessJourney
      kind="yard"
      application={{ business: {}, files: [] } as unknown as Application}
      loginPhone={undefined}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Business draft" }), {
    target: { value: "Retained business" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to documents" }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Document draft" }), {
    target: { value: "Retained document" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Back to business" }));
  expect(screen.getByRole("textbox", { name: "Business draft" })).toHaveValue(
    "Retained business",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to documents" }),
  );
  expect(screen.getByRole("textbox", { name: "Document draft" })).toHaveValue(
    "Retained document",
  );
});

it("opens documents immediately when saved business details are complete", () => {
  render(
    <BusinessJourney
      kind="yard"
      application={{ business, files: [] } as unknown as Application}
      loginPhone={undefined}
    />,
  );
  expect(screen.getByRole("textbox", { name: "Document draft" })).toBeVisible();
  expect(
    screen.queryByRole("textbox", { name: "Business draft" }),
  ).not.toBeInTheDocument();
});
