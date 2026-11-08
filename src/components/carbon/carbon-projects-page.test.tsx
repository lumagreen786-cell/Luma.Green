import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { CarbonProjectsPage } from "./carbon-projects-page";

const state = vi.hoisted(() => ({
  role: "owner",
  mutation: vi.fn(),
  query: vi.fn<(name: string, args: unknown) => unknown>(),
}));

vi.mock("convex/react", () => ({
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) =>
    state.query(getFunctionName(fn), args),
  useMutation: () => state.mutation,
}));
vi.mock("@/components/app/use-workspace", () => ({
  useWorkspace: () => ({ kind: "org", org: { id: "org-1" }, role: state.role }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const rows = [
  {
    id: "project-1",
    facilityId: "facility-1",
    name: "PET pilot",
    facilityName: "Example facility",
    method: "verra_vmr0007",
    status: "draft",
    evidenceStatus: "reported_unverified",
    revision: 5,
    updatedAt: 100,
    evidence: [
      "baseline",
      "monitoring",
      "claim_rights",
      "verification_report",
      "registry_issuance",
    ].map((kind) => ({
      kind,
      reference: `Example ${kind}`,
      recordedAt: 100,
    })),
  },
];

function renderPage() {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
    >
      <CarbonProjectsPage />
    </NextIntlClientProvider>,
  );
}

const queries: Record<string, unknown> = {
  "carbonProjects:mine": { rows, hasMore: false },
  "carbonProjects:batches": { rows: [], hasMore: false },
  "carbonProjects:batchOptions": { rows: [], hasMore: false },
  "industrialProfiles:mine": [{ _id: "facility-1", name: "Example facility" }],
};

beforeEach(() => {
  state.role = "owner";
  state.mutation.mockReset().mockResolvedValue(null);
  state.query.mockReset().mockImplementation((name) => queries[name]);
});

it("allows a manager to review the current revision and labels registry references unverified", async () => {
  renderPage();
  expect(screen.getByText(/Reported · unverified/u)).toBeVisible();
  expect(screen.getByText("Example registry_issuance")).toBeVisible();
  expect(state.query).toHaveBeenCalledWith("carbonProjects:mine", {
    expectedOrgId: "org-1",
  });
  await userEvent.click(
    screen.getByRole("button", { name: messages.carbonProjects.review }),
  );
  expect(state.mutation).toHaveBeenCalledWith({
    expectedOrgId: "org-1",
    projectId: "project-1",
    expectedRevision: 5,
  });
});

it("leaves a viewer with read-only evidence and no mutation controls", () => {
  state.role = "viewer";
  renderPage();
  expect(screen.getByRole("heading", { name: "PET pilot" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: messages.evidence.record }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: messages.carbonProjects.review }),
  ).not.toBeInTheDocument();
});

it("loads batch records on demand and requests removal at the current revision", async () => {
  const batchQueries: Record<string, unknown> = {
    ...queries,
    "carbonProjects:batches": {
      rows: [{ transformationId: "batch-1", inputGrams: 450, recordedAt: 100 }],
      hasMore: false,
    },
  };
  state.query.mockImplementation((name) => batchQueries[name]);
  renderPage();
  expect(state.query).not.toHaveBeenCalledWith(
    "carbonProjects:batches",
    expect.anything(),
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.operations.batches }),
  );
  await userEvent.click(screen.getByRole("button", { name: /Remove ·/u }));
  expect(state.mutation).toHaveBeenCalledWith({
    expectedOrgId: "org-1",
    projectId: "project-1",
    transformationId: "batch-1",
    expectedRevision: 5,
  });
});
