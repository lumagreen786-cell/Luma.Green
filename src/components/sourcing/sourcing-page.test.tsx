import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FunctionReference, getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import { fakeQueries, renderWithIntl } from "@/components/shop/test-helpers";
import { WorkspacePermissions } from "@/components/workspace/permissions";

import en from "../../../messages/en.json";
import { ReferenceAction, whole } from "./forms";
import { SourcingPage } from "./sourcing-page";
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
const mocks = vi.hoisted(() => ({
  role: "owner",
  save: vi.fn(),
  loadMore: vi.fn(),
  query:
    vi.fn<(query: FunctionReference<"query">, args?: unknown) => unknown>(),
  paginated: vi.fn<(query: FunctionReference<"query">) => unknown>(),
}));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.save,
  usePaginatedQuery: (query: FunctionReference<"query">) =>
    mocks.paginated(query),
  useQuery: (query: FunctionReference<"query">, args: unknown) =>
    mocks.query(query, args),
}));
vi.mock("@/components/app/use-workspace", () => ({
  useWorkspace: () => ({ kind: "org", org: { id: "org-a" }, role: mocks.role }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  mocks.role = "owner";
  mocks.save.mockReset().mockResolvedValue(null);
  mocks.loadMore.mockReset();
  mocks.query.mockImplementation(
    fakeQueries({
      "demand:board": {
        canPost: true,
        mine: [],
        available: [],
        truncated: false,
      },
      "sourcing:options": { materials: [], suppliers: [], truncated: false },
    }),
  );
  mocks.paginated.mockReturnValue({
    results: [],
    status: "Exhausted",
    loadMore: mocks.loadMore,
    isLoading: false,
  });
});
it("shows sourcing stages with the no-stock and no-payment boundary", () => {
  renderWithIntl(
    <WorkspacePermissions membershipRole="owner">
      <SourcingPage />
    </WorkspacePermissions>,
  );
  expect(
    screen.getByRole("heading", { name: en.sourcing.title }),
  ).toBeVisible();
  expect(screen.getAllByRole("tab")).toHaveLength(4);
  expect(screen.getByText(en.sourcing.boundary)).toBeVisible();
  expect(screen.getByRole("button", { name: en.sourcing.post })).toBeVisible();
});
it("does not offer mutations to viewers", async () => {
  mocks.role = "viewer";
  const user = userEvent.setup();
  renderWithIntl(
    <WorkspacePermissions membershipRole="viewer">
      <SourcingPage />
    </WorkspacePermissions>,
  );
  expect(
    screen.queryByRole("button", { name: en.sourcing.post }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: en.sourcing.plans }));
  expect(
    screen.queryByRole("button", { name: en.sourcing.createPlan }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(en.sourcing.readOnly)).toBeVisible();
});
it("retains a failed reference draft and allows an explicit retry", async () => {
  mocks.save.mockRejectedValueOnce(new Error("offline"));
  const user = userEvent.setup();
  renderWithIntl(
    <ReferenceAction
      title={en.sourcing.acknowledge}
      hint={en.sourcing.boundary}
      onSave={mocks.save}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: en.sourcing.acknowledge }),
  );
  await user.type(
    screen.getByLabelText(en.sourcing.responseReference),
    "LOCAL-ACK",
  );
  await user.click(screen.getByRole("button", { name: en.sourcing.save }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.sourcing.failed,
  );
  expect(screen.getByLabelText(en.sourcing.responseReference)).toHaveValue(
    "LOCAL-ACK",
  );
  await user.click(screen.getByRole("button", { name: en.sourcing.save }));
  expect(mocks.save).toHaveBeenCalledTimes(2);
});
it("keeps a pending save single-shot and prevents closing away its draft", async () => {
  mocks.save.mockReturnValue(
    new Promise(() => {
      /* Keep the request pending to test duplicate prevention. */
    }),
  );
  const user = userEvent.setup();
  renderWithIntl(
    <ReferenceAction
      title={en.sourcing.acknowledge}
      hint={en.sourcing.boundary}
      onSave={mocks.save}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: en.sourcing.acknowledge }),
  );
  await user.type(
    screen.getByLabelText(en.sourcing.responseReference),
    "LOCAL-ACK",
  );
  await user.click(screen.getByRole("button", { name: en.sourcing.save }));
  expect(screen.getByRole("button", { name: en.sourcing.save })).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(mocks.save).toHaveBeenCalledTimes(1);
});
it("loads older supplier decisions without exposing supplier mutation controls", async () => {
  mocks.paginated.mockImplementation((query) => ({
    results:
      getFunctionName(query) === "sourcing:qualifications"
        ? [
            {
              record: {
                _id: "q-1",
                materialCode: "PAPER-NEWS",
                decision: "approved",
                validUntil: "2026-12-01",
                specification: "Dry paper",
                sampleReference: "SAMPLE",
                reason: "Buyer decision",
                createdAt: 1,
              },
              supplierName: "Local supplier",
            },
          ]
        : [],
    status: "CanLoadMore",
    loadMore: mocks.loadMore,
    isLoading: false,
  }));
  const user = userEvent.setup();
  renderWithIntl(
    <WorkspacePermissions membershipRole="viewer">
      <SourcingPage />
    </WorkspacePermissions>,
  );
  await user.click(
    screen.getByRole("tab", { name: en.sourcing.qualifications }),
  );
  expect(screen.getByText(/Local supplier/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: en.sourcing.loadMore }));
  expect(mocks.loadMore).toHaveBeenCalledWith(20);
  expect(
    screen.queryByRole("button", { name: en.sourcing.qualify }),
  ).not.toBeInTheDocument();
});
it("rejects invalid local integer input and keeps exact script digits", () => {
  const data = new FormData();
  data.set("grams", "١٠٠١");
  expect(whole(data, "grams")).toBe(1001);
  for (const invalid of ["1.1", "1,000", "9007199254740992"]) {
    data.set("grams", invalid);
    expect(() => whole(data, "grams")).toThrow("INVALID_INPUT");
  }
});
it("rejects invalid reference before any write", async () => {
  const user = userEvent.setup();
  renderWithIntl(
    <ReferenceAction
      title={en.sourcing.acknowledge}
      hint={en.sourcing.boundary}
      onSave={mocks.save}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: en.sourcing.acknowledge }),
  );
  const input = screen.getByLabelText(en.sourcing.responseReference);
  fireEvent.change(input, { target: { value: "x" } });
  fireEvent.submit(input.closest("form") ?? input);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.sourcing.failed,
  );
  expect(mocks.save).not.toHaveBeenCalled();
});
it("offers an explicit date change for an overdue schedule while preserving its expected date", async () => {
  mocks.paginated.mockImplementation((query) => ({
    results:
      getFunctionName(query) === "sourcing:plans"
        ? [
            {
              _id: "plan-a",
              materialCode: "PAPER-NEWS",
              quantityGrams: 1000,
              status: "active",
              everyDays: 7,
              nextNeededBy: "2026-09-01",
              specification: "Dry paper",
            },
          ]
        : [],
    status: "Exhausted",
    loadMore: mocks.loadMore,
  }));
  const user = userEvent.setup();
  renderWithIntl(
    <WorkspacePermissions membershipRole="owner">
      <SourcingPage />
    </WorkspacePermissions>,
  );
  await user.click(screen.getByRole("tab", { name: en.sourcing.plans }));
  expect(screen.getByText(en.sourcing.overdue)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: en.sourcing.reschedule }),
  );
  fireEvent.change(screen.getByLabelText(en.sourcing.neededBy), {
    target: { value: "2026-10-01" },
  });
  await user.click(screen.getByRole("button", { name: en.sourcing.save }));
  expect(mocks.save).toHaveBeenCalledWith({
    planId: "plan-a",
    expectedDate: "2026-09-01",
    neededBy: "2026-10-01",
  });
});

it("retains a sourcing draft after closing its dialog and switching tasks", async () => {
  const user = userEvent.setup();
  renderWithIntl(
    <WorkspacePermissions membershipRole="owner">
      <SourcingPage />
    </WorkspacePermissions>,
  );
  await user.click(screen.getByRole("button", { name: en.sourcing.post }));
  await user.type(
    screen.getByLabelText(en.sourcing.specification),
    "Clean dry paper draft",
  );
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("tab", { name: en.sourcing.plans }));
  await user.click(screen.getByRole("tab", { name: en.sourcing.board }));
  await user.click(screen.getByRole("button", { name: en.sourcing.post }));
  expect(screen.getByLabelText(en.sourcing.specification)).toHaveValue(
    "Clean dry paper draft",
  );
  expect(mocks.save).not.toHaveBeenCalled();
});
