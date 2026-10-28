import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, expect, it, vi } from "vitest";

import { WorkspacePermissions } from "@/components/workspace/permissions";

import en from "../../../messages/en.json";
import { StockIntake } from "./stock-intake";
import { renderWithIntl } from "./test-helpers";

const state = vi.hoisted(() => ({
  save: vi.fn(),
  loadMore: vi.fn(),
  status: "Exhausted",
  choices: [
    { code: "PAPER-NEWS", names: { en: "Local offcuts" }, family: "paper" },
  ],
  results: [] as unknown[],
}));
vi.mock("convex/react", () => ({
  useMutation: () => state.save,
  useQuery: () => state.choices,
  usePaginatedQuery: () => ({
    results: state.results,
    status: state.status,
    loadMore: state.loadMore,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  state.save.mockReset();
  state.save.mockResolvedValue("saved");
  state.loadMore.mockReset();
  state.status = "Exhausted";
  state.results = [];
  state.choices = [
    { code: "PAPER-NEWS", names: { en: "Local offcuts" }, family: "paper" },
  ];
});
function render(role: "member" | "viewer" = "member") {
  return renderWithIntl(
    <WorkspacePermissions membershipRole={role}>
      <StockIntake />
    </WorkspacePermissions>,
  );
}
it("allows viewer history pagination but no stock intake writes", async () => {
  state.status = "CanLoadMore";
  render("viewer");
  expect(
    screen.queryByRole("button", { name: en.stockIntake.add }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: en.stockIntake.more }),
  );
  expect(state.loadMore).toHaveBeenCalledWith(20);
});
it("requires exact grams and attestation, sends explicit intake, and preserves conflicts", async () => {
  const user = userEvent.setup();
  render();
  await user.click(screen.getByRole("button", { name: en.stockIntake.add }));
  await user.type(
    screen.getByLabelText(en.stockIntake.reference),
    "UNIQUE-INTAKE",
  );
  await user.click(screen.getByRole("combobox", { name: en.lots.material }));
  await user.click(screen.getByRole("option", { name: "Local offcuts" }));
  await user.type(screen.getByLabelText(en.lots.mass), "1.5");
  fireEvent.change(screen.getByLabelText(en.stockIntake.date), {
    target: { value: "2026-01-01" },
  });
  await user.type(screen.getByLabelText(en.stockIntake.source), "BATCH-1");
  await user.type(screen.getByLabelText(en.stockIntake.weighing), "WEIGH-1");
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(state.save).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText(en.lots.mass));
  await user.type(screen.getByLabelText(en.lots.mass), "2000");
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(state.save).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("checkbox", { name: en.stockIntake.confirm }),
  );
  state.save.mockRejectedValue(new ConvexError("INTAKE_REFERENCE_CONFLICT"));
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(state.save).toHaveBeenCalledWith({
    intakeReference: "UNIQUE-INTAKE",
    materialCode: "PAPER-NEWS",
    grams: 2000,
    producedOn: "2026-01-01",
    sourceReference: "BATCH-1",
    weighingReference: "WEIGH-1",
    ownProductionConfirmed: true,
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.stockIntake.conflict,
  );
  expect(screen.getByLabelText(en.stockIntake.weighing)).toHaveValue("WEIGH-1");
});
it("disables recording when no approved material is available", async () => {
  state.choices = [];
  render();
  await userEvent.click(
    screen.getByRole("button", { name: en.stockIntake.add }),
  );
  expect(screen.getByText(en.stockIntake.noMaterials)).toBeVisible();
  expect(screen.getByRole("button", { name: en.lots.save })).toBeDisabled();
});

async function validIntake(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: en.stockIntake.add }));
  await user.type(
    screen.getByLabelText(en.stockIntake.reference),
    "COST-INTAKE",
  );
  await user.click(screen.getByRole("combobox", { name: en.lots.material }));
  await user.click(screen.getByRole("option", { name: "Local offcuts" }));
  await user.type(screen.getByLabelText(en.lots.mass), "2000");
  fireEvent.change(screen.getByLabelText(en.stockIntake.date), {
    target: { value: "2026-01-01" },
  });
  await user.type(screen.getByLabelText(en.stockIntake.source), "BATCH-1");
  await user.type(screen.getByLabelText(en.stockIntake.weighing), "WEIGH-1");
  await user.click(
    screen.getByRole("checkbox", { name: en.stockIntake.confirm }),
  );
}

it("sends exactly one hundred paise from native digits and requires its recorded allocation reference", async () => {
  const user = userEvent.setup();
  render();
  await validIntake(user);
  await user.type(screen.getByLabelText(en.recordedCosts.acquisition), "١٠٠");
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(state.save).not.toHaveBeenCalled();
  await user.type(
    screen.getByLabelText(en.recordedCosts.reference),
    "ALLOCATED-COST-REFERENCE",
  );
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(state.save).toHaveBeenCalledWith(
    expect.objectContaining({
      grams: 2000,
      recordedCostPaise: 100,
      costReference: "ALLOCATED-COST-REFERENCE",
    }),
  );
});

it("rejects fractional paise and sends a blank cost as unknown rather than zero", async () => {
  const user = userEvent.setup();
  render();
  await validIntake(user);
  await user.type(screen.getByLabelText(en.recordedCosts.acquisition), "1.5");
  await user.type(
    screen.getByLabelText(en.recordedCosts.reference),
    "RECORDED-COST",
  );
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(state.save).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText(en.recordedCosts.acquisition));
  await user.clear(screen.getByLabelText(en.recordedCosts.reference));
  await user.click(screen.getByRole("button", { name: en.lots.save }));
  expect(state.save).toHaveBeenCalledWith(
    expect.objectContaining({
      recordedCostPaise: undefined,
      costReference: undefined,
    }),
  );
});

it("shows the intake allocation as exact currency in read-only history", () => {
  state.results = [
    {
      id: "intake-1",
      intakeReference: "RECORDED-INTAKE",
      grams: 2000,
      materialCode: "PAPER-NEWS",
      producedOn: "2026-01-01",
      sourceReference: "BATCH-1",
      weighingReference: "WEIGH-1",
      recordedCostPaise: 1,
      costReference: "ALLOCATED-COST-EVIDENCE",
    },
  ];
  render("viewer");
  expect(screen.getByText("₹0.01")).toBeVisible();
  expect(screen.getByText(/ALLOCATED-COST-EVIDENCE/)).toBeVisible();
});
