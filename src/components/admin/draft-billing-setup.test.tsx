import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";

import { DraftBillingSetup } from "./draft-billing-setup";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  draft: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref).endsWith(":recordDraftPriceBook")
      ? mocks.save
      : mocks.draft,
  usePaginatedQuery: () => ({
    results: [{ orgId: "site-a", name: "Peenya Yard", city: "Bengaluru" }],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));
beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue("book-a");
  mocks.draft.mockReset().mockResolvedValue("draft-a");
});

it("records explicit exact prices and drafts a completed period without checkout", async () => {
  const user = userEvent.setup();
  render(<DraftBillingSetup />);
  await user.type(screen.getByLabelText("Price book version"), "pilot-1");
  fireEvent.change(screen.getByLabelText("First billing month"), {
    target: { value: "2026-09" },
  });
  await user.type(screen.getByLabelText("Yard"), "7499.50");
  await user.type(screen.getByLabelText("Order fee in basis points"), "50");
  await user.type(
    screen.getByLabelText("Maximum fee per order in rupees"),
    "5000",
  );
  await user.click(
    screen.getByRole("button", { name: "Save draft price book" }),
  );
  await waitFor(() => {
    expect(mocks.save).toHaveBeenCalledWith({
      version: "pilot-1",
      startsMonth: "2026-09",
      plans: [{ plan: "yard", monthlyPaise: 749_950 }],
      feeBps: 50,
      feeCapPaise: 500_000,
    });
  });
  await user.selectOptions(screen.getByLabelText("Business site"), "site-a");
  await user.selectOptions(screen.getByLabelText("Draft plan"), "yard");
  await user.type(screen.getByLabelText("Price book for invoice"), "pilot-1");
  fireEvent.change(screen.getByLabelText("Completed billing month"), {
    target: { value: "2026-10" },
  });
  await user.click(
    screen.getByRole("button", { name: "Generate draft invoice" }),
  );
  await waitFor(() => {
    expect(mocks.draft).toHaveBeenCalledWith({
      orgId: "site-a",
      month: "2026-10",
      plan: "yard",
      priceBookVersion: "pilot-1",
    });
  });
  expect(
    screen.queryByRole("button", { name: /checkout|charge|pay now/i }),
  ).not.toBeInTheDocument();
});
