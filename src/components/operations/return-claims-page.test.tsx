import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";
import { beforeEach, expect, it, vi } from "vitest";

import { useWorkspace } from "@/components/app/use-workspace";
import { fakeQueries, SHOP_WORKSPACE } from "@/components/shop/test-helpers";

import messages from "../../../messages/en.json";
import { ReturnClaimsPage } from "./return-claims-page";
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("@/components/app/use-workspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "test-owner" } } }) },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const mutate = vi.fn();
beforeEach(() => {
  mutate.mockReset();
  mutate.mockResolvedValue(null);
  vi.mocked(useMutation).mockReturnValue(
    mutate as unknown as ReturnType<typeof useMutation>,
  );
  vi.mocked(useWorkspace).mockReturnValue({
    ...SHOP_WORKSPACE,
    role: "owner",
  } as ReturnType<typeof useWorkspace>);
});
const record = {
  id: "return-test",
  tradeId: "trade-test",
  sellerOrgId: "org-1",
  buyerOrgId: "org-buyer",
  proposedByOrgId: "org-buyer",
  destinationOrgId: "org-1",
  reference: "TEST RETURN",
  reason: "Quality rejection",
  freightPayer: "seller",
  grams: 1001,
  status: "received",
  proposedByProfileId: "test",
  createdAt: 0,
  updatedAt: 0,
  materialCode: "PAPER-NEWS",
  isMoneyReconciled: false,
};
function show(role = "owner", status = "received") {
  vi.mocked(useWorkspace).mockReturnValue({
    ...SHOP_WORKSPACE,
    role,
  } as ReturnType<typeof useWorkspace>);
  vi.mocked(useQuery).mockImplementation(
    fakeQueries({
      "returns:options": [],
      "returns:mine": { rows: [{ ...record, status }], hasMore: false },
      "schemeClaims:mine": { rows: [], hasMore: false },
    }) as unknown as typeof useQuery,
  );
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReturnClaimsPage />
    </NextIntlClientProvider>,
  );
}
it("keeps provider reconciliation visibly pending after physical receipt", () => {
  show();
  expect(screen.getByText(messages.returnClaims.waiting)).toBeVisible();
  expect(screen.getByRole("button", { name: "Reconcile" })).toBeDisabled();
  expect(screen.getByText(messages.returnClaims.notice)).toBeVisible();
});
it("keeps viewer records read only", () => {
  show("viewer");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText(/TEST RETURN/)).toBeVisible();
});
it("retains review inputs when approval fails", async () => {
  const user = userEvent.setup();
  mutate.mockRejectedValue(new Error("Permission changed"));
  show("owner", "proposed");
  await user.type(screen.getByLabelText("Reason"), "Keep this review note");
  await user.click(screen.getByRole("button", { name: "Accept" }));
  expect(screen.getByLabelText("Reason")).toHaveValue("Keep this review note");
  expect(toast.error).toHaveBeenCalled();
});
