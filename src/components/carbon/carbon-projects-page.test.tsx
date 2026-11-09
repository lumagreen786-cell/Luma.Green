import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import { carbonFrameworkIds, carbonFrameworks } from "@/lib/carbon-frameworks";

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
  "carbonProjects:frameworkScreenings": [],
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

async function choose(label: string, option: string, scope: HTMLElement) {
  await userEvent.click(within(scope).getByRole("combobox", { name: label }));
  await userEvent.click(screen.getByRole("option", { name: option }));
}

async function openScreening() {
  const title = messages.carbonProjects.screening.title;
  await userEvent.click(screen.getByRole("button", { name: title }));
  return screen.getByRole("region", { name: title });
}

it("shows all named frameworks to viewers with accounting-only GHG requirements", async () => {
  state.role = "viewer";
  renderPage();
  const labels = messages.carbonProjects.screening;
  const section = await openScreening();
  const select = within(section).getByRole("combobox", {
    name: labels.framework,
  });
  await userEvent.click(select);
  for (const id of carbonFrameworkIds) {
    expect(
      screen.getByRole("option", { name: carbonFrameworks[id].name }),
    ).toBeVisible();
  }
  await userEvent.click(screen.getByRole("option", { name: "GHG Protocol" }));
  expect(within(section).getByText(labels.fit.accounting_only)).toBeVisible();
  expect(
    within(section).getByText(labels.gates.inventory_boundary_and_scopes),
  ).toBeVisible();
  expect(
    within(section).queryByText(labels.gates.issuance),
  ).not.toBeInTheDocument();
  expect(
    within(section).queryByRole("button", { name: labels.save }),
  ).not.toBeInTheDocument();
  expect(state.query).toHaveBeenCalledWith(
    "carbonProjects:frameworkScreenings",
    {
      expectedOrgId: "org-1",
      projectId: "project-1",
    },
  );
});

it("retains an unfinished check when switching frameworks and saves against its screening revision", async () => {
  const labels = messages.carbonProjects.screening;
  const results: Record<string, unknown> = {
    ...queries,
    "carbonProjects:frameworkScreenings": [
      {
        framework: "verra",
        revision: 3,
        checks: [
          {
            gate: "registration",
            status: "contradicted",
            reference: "Reported listing decision",
          },
        ],
      },
    ],
  };
  state.query.mockImplementation((name) => results[name]);
  renderPage();
  const section = await openScreening();
  expect(
    within(section).getByText(labels.status.contradicted, {
      selector: "dd span",
    }),
  ).toBeVisible();
  expect(within(section).getByText("Reported listing decision")).toBeVisible();
  await choose(labels.check, labels.gates.registration, section);
  await choose(labels.result, labels.status.supported, section);
  const reference = within(section).getByLabelText(messages.evidence.reference);
  await userEvent.type(reference, "Updated listing decision");
  await choose(labels.framework, "Gold Standard", section);
  expect(
    within(section).getByLabelText(messages.evidence.reference),
  ).toHaveValue("");
  await choose(labels.framework, "Verra VCS", section);
  expect(
    within(section).getByLabelText(messages.evidence.reference),
  ).toHaveValue("Updated listing decision");
  await userEvent.click(
    within(section).getByRole("button", { name: labels.save }),
  );
  expect(state.mutation).toHaveBeenCalledWith({
    expectedOrgId: "org-1",
    projectId: "project-1",
    expectedRevision: 3,
    framework: "verra",
    gate: "registration",
    status: "supported",
    reference: "Updated listing decision",
  });
});

it("sets the matched methodology when an operator selects an industry", async () => {
  const labels = messages.carbonProjects;
  renderPage();
  const field = screen.getByLabelText(labels.name);
  const form = field.closest("form");
  if (!form) throw new Error("Create form missing");
  await userEvent.type(field, "Biogas pilot");
  await choose(messages.lots.facility, "Example facility", form);
  await choose(
    labels.industry.title,
    labels.industry.labels.compressed_biogas,
    form,
  );
  expect(within(form).getByText("BEE BM WA03.003")).toBeVisible();
  await userEvent.click(
    within(form).getByRole("button", { name: messages.operations.save }),
  );
  expect(state.mutation).toHaveBeenCalledWith({
    expectedOrgId: "org-1",
    facilityId: "facility-1",
    name: "Biogas pilot",
    method: "bee_wa03_003",
    industry: "compressed_biogas",
  });
});
