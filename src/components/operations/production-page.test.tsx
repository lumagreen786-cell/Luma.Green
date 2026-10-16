import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { fakeQueries, renderWithIntl } from "@/components/shop/test-helpers";

import en from "../../../messages/en.json";
import { ProductionPage } from "./production-page";
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
const mock = vi.hoisted(() => ({ role: "owner", save: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("@/components/app/use-workspace", () => ({
  useWorkspace: () => ({ kind: "org", org: { id: "org-a" }, role: mock.role }),
}));
beforeEach(() => {
  mock.role = "owner";
  mock.save.mockReset().mockResolvedValue("saved");
  vi.mocked(useMutation).mockReturnValue(
    mock.save as unknown as ReturnType<typeof useMutation>,
  );
  vi.mocked(useQuery).mockImplementation(
    fakeQueries({
      "production:mine": {
        recipes: [],
        batches: [],
        transformations: [],
        truncated: false,
      },
    }) as unknown as typeof useQuery,
  );
});
it("keeps production viewers read-only and states the evidence boundary", async () => {
  mock.role = "viewer";
  renderWithIntl(<ProductionPage />);
  expect(screen.getByText(en.operations.productionHint)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: en.operations.newRecipe }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("tab", { name: en.operations.batches }),
  );
  expect(
    screen.queryByRole("button", { name: en.operations.newBatch }),
  ).not.toBeInTheDocument();
});
it("rejects an unbalanced recipe and retains a failed valid draft", async () => {
  const user = userEvent.setup();
  renderWithIntl(<ProductionPage />);
  await user.click(
    screen.getByRole("button", { name: en.operations.newRecipe }),
  );
  for (const [label, value] of [
    [en.operations.reference, "REC-TEST"],
    [en.operations.version, "V1"],
    [en.operations.name, "Test recipe"],
    [en.operations.instructions, "Measured process record"],
    [en.operations.ingredient, "PET"],
  ] as const)
    await user.type(screen.getByLabelText(label), value);
  const share = screen.getByLabelText(en.operations.basisPoints);
  await user.clear(share);
  await user.type(share, "9000");
  await user.click(screen.getByRole("button", { name: en.operations.save }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.operations.invalid,
  );
  expect(mock.save).not.toHaveBeenCalled();
  await user.clear(share);
  await user.type(share, "10000");
  mock.save.mockRejectedValueOnce(new Error("offline"));
  await user.click(screen.getByRole("button", { name: en.operations.save }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.operations.failed,
  );
  expect(screen.getByLabelText(en.operations.reference)).toHaveValue(
    "REC-TEST",
  );
});

it("keeps an unfinished recipe when switching production tasks", async () => {
  const user = userEvent.setup();
  renderWithIntl(<ProductionPage />);
  await user.click(
    screen.getByRole("button", { name: en.operations.newRecipe }),
  );
  await user.type(
    screen.getByLabelText(en.operations.reference),
    "RECIPE-DRAFT",
  );
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("tab", { name: en.operations.batches }));
  await user.click(screen.getByRole("tab", { name: en.operations.recipes }));
  await user.click(
    screen.getByRole("button", { name: en.operations.newRecipe }),
  );
  expect(screen.getByLabelText(en.operations.reference)).toHaveValue(
    "RECIPE-DRAFT",
  );
  expect(mock.save).not.toHaveBeenCalled();
});
