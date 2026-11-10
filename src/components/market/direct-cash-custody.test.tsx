import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { DirectCashCustody } from "./direct-cash-custody";
import { aTrade, WithIntl } from "./test-utils";

const { move } = vi.hoisted(() => ({ move: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: () => move,
  useQuery: (_query: unknown, args: unknown) =>
    args === "skip" ? undefined : { action: "receive" },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

it("records physical receipt only with the exact measured grams and reference", async () => {
  move.mockResolvedValue("recorded-custody");
  const user = userEvent.setup();
  render(
    <WithIntl locale="ar">
      <DirectCashCustody
        trade={aTrade({ grams: 1000, status: "dispatched" })}
      />
    </WithIntl>,
  );
  await user.click(screen.getByText("Confirm receipt"));
  await user.type(
    await screen.findByRole("textbox", { name: "Mass (g)" }),
    "٩٩٩",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Dispatch or receipt reference" }),
    "Physical receipt test",
  );
  const confirm = screen.getByRole("button", { name: "Confirm" });
  expect(confirm).toBeDisabled();
  const input = screen.getByRole("textbox", { name: "Mass (g)" });
  await user.clear(input);
  await user.type(input, "١٠٠٠");
  await user.click(confirm);
  expect(move).toHaveBeenCalledWith({
    tradeId: "trade1",
    movement: {
      kind: "receive",
      grams: 1000,
      reference: "Physical receipt test",
    },
  });
});
