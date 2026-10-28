import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeQueries, renderWithIntl } from "@/components/shop/test-helpers";
import { WorkspacePermissions } from "@/components/workspace/permissions";

import type { Id } from "../../../convex/_generated/dataModel";
import en from "../../../messages/en.json";
import { InspectionForm } from "./inspections";
import {
  DeclareLot,
  ReceiveLot,
  RecordDisposition,
  TransformLot,
} from "./lot-forms";
import { LotDetailPage, LotsPage } from "./lots-page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  mutate: vi.fn(),
  business: { id: "business-1", city: "Bengaluru", kind: "kabadiwala" },
}));
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("@/components/shop/use-shop", () => ({
  useBusiness: () => mocks.business,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
const lotId = "lot-1" as Id<"materialLots">;
const lot = {
  id: lotId,
  materialCode: "PET",
  state: "Bale",
  sourceKind: "self_declared",
  initialGrams: 1234,
  availableGrams: 1234,
  status: "available",
  createdAt: 0,
  streamClass: "unspecified",
  handlingClass: "unassessed",
};
const history = {
  access: "holder",
  lot,
  custody: [],
  transformations: [],
  hasMoreCustody: false,
  hasMoreTransformations: false,
  dispositions: [],
  hasMoreDispositions: false,
};
function queries(extra: Record<string, unknown> = {}) {
  vi.mocked(useQuery).mockImplementation(
    fakeQueries({
      "industrialProfiles:mine": [],
      "traceability:mine": { rows: [lot], hasMore: false },
      "traceability:incoming": { rows: [], hasMore: false },
      "traceability:sent": { rows: [], hasMore: false },
      "traceability:history": history,
      "quality:forLot": { rows: [], hasMore: false },
      ...extra,
    }) as unknown as typeof useQuery,
  );
}
function render(ui: ReactNode, role: "owner" | "member" | "viewer" = "owner") {
  return renderWithIntl(
    <WorkspacePermissions membershipRole={role}>{ui}</WorkspacePermissions>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutate.mockReset();
  vi.mocked(useMutation).mockReturnValue(
    mocks.mutate as unknown as ReturnType<typeof useMutation>,
  );
  queries();
});

describe("lot evidence surfaces", () => {
  it("shows exact grams to viewers while hiding all write controls", () => {
    render(<LotsPage />, "viewer");
    expect(screen.getByRole("link", { name: "PET · Bale" })).toHaveAttribute(
      "href",
      "/app/lots/lot-1",
    );
    expect(screen.getByText("1,234 g")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Declare a lot" }),
    ).not.toBeInTheDocument();
  });
  it("never loads private inspection evidence for a pending receiver", () => {
    queries({
      "traceability:history": {
        ...history,
        access: "pending_receiver",
        lot: {
          ...lot,
          status: "in_transit",
          initialGrams: undefined,
          sourceKind: undefined,
        },
      },
    });
    render(<LotDetailPage lotId={lotId} />);
    expect(screen.getByRole("button", { name: "Receive lot" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Inspection evidence" }),
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(useQuery)
        .mock.calls.some(
          ([reference]) => getFunctionName(reference) === "quality:forLot",
        ),
    ).toBe(false);
  });
  it("rejects fractional grams and retains the declaration after a recoverable save failure", async () => {
    const user = userEvent.setup();
    mocks.mutate.mockRejectedValueOnce(new Error("Connection dropped"));
    render(<DeclareLot />, "member");
    await user.click(screen.getByRole("button", { name: "Declare a lot" }));
    await user.type(screen.getByLabelText("Material code or name"), "PET");
    await user.type(screen.getByLabelText("Physical state"), "Bale");
    await user.type(screen.getByLabelText("Mass (g)"), "1.5");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use whole grams",
    );
    expect(mocks.mutate).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Mass (g)"));
    await user.type(screen.getByLabelText("Mass (g)"), "1234");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your values are kept",
    );
    expect(screen.getByLabelText("Material code or name")).toHaveValue("PET");
    expect(screen.getByLabelText("Mass (g)")).toHaveValue("1234");
    mocks.mutate.mockResolvedValueOnce(lotId);
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(mocks.mutate).toHaveBeenLastCalledWith({
      materialCode: "PET",
      state: "Bale",
      grams: 1234,
      sourceReference: undefined,
      streamClass: "unspecified",
      handlingClass: "unassessed",
    });
    expect(mocks.push).toHaveBeenCalledWith("/app/lots/lot-1");
  });
  it("requires exact transformation balance before saving", async () => {
    const user = userEvent.setup();
    mocks.mutate.mockResolvedValue("transformation-1");
    render(<TransformLot lotId={lotId} availableGrams={1000} />);
    await user.click(
      screen.getByRole("button", { name: "Record transformation" }),
    );
    await user.type(screen.getByLabelText("Input mass (g)"), "1000");
    const output = within(screen.getByRole("group", { name: "Output 1" }));
    await user.type(output.getByLabelText("Material code or name"), "PET");
    await user.type(output.getByLabelText("Physical state"), "Flake");
    await user.type(output.getByLabelText("Mass (g)"), "999");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Input mass must equal",
    );
    expect(mocks.mutate).not.toHaveBeenCalled();
    await user.clear(output.getByLabelText("Mass (g)"));
    await user.type(output.getByLabelText("Mass (g)"), "1000");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      inputLotId: lotId,
      additionalInputs: undefined,
      facilityId: undefined,
      processKind: undefined,
      inputGrams: 1000,
      contaminationGrams: 0,
      processLossGrams: 0,
      processingCostPaise: undefined,
      costReference: undefined,
      operationReference: expect.any(String),
      outputs: [
        {
          materialCode: "PET",
          state: "Flake",
          grams: 1000,
          streamClass: "unspecified",
          handlingClass: "unassessed",
        },
      ],
    });
  });
  it("does not accept a different received mass or discard it after server rejection", async () => {
    const user = userEvent.setup();
    mocks.mutate.mockRejectedValue(
      new ConvexError("WORKSPACE_PERMISSION_DENIED"),
    );
    render(<ReceiveLot lotId={lotId} grams={1000} />);
    await user.click(screen.getByRole("button", { name: "Receive lot" }));
    await user.type(screen.getByLabelText("Received mass (g)"), "999");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Receipt was not recorded",
    );
    expect(mocks.mutate).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Received mass (g)"));
    await user.type(screen.getByLabelText("Received mass (g)"), "1000");
    await user.click(screen.getByRole("button", { name: "Save record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "workspace access has changed",
    );
    expect(screen.getByLabelText("Received mass (g)")).toHaveValue("1000");
  });
});

it("retains original and corrected inspection records and exposes only permitted actions", async () => {
  const user = userEvent.setup();
  const original = {
    id: "inspection-1",
    orgId: "business-1",
    orgName: "Measured works",
    assessmentScope: "inspecting_org",
    specificationReference: "Recorded specification",
    specificationVersion: "1",
    sampleMethod: "Composite sample",
    results: [{ parameter: "Moisture", unit: "%", value: "2" }],
    decision: "conditional",
    createdAt: 0,
    isSuperseded: false,
    canApprove: false,
    canCorrect: true,
  };
  const corrected = {
    ...original,
    id: "inspection-2",
    supersedesInspectionId: original.id,
    correctionReason: "Corrected lab measurement",
    results: [{ parameter: "Moisture", unit: "%", value: "3" }],
    canCorrect: false,
    canApprove: true,
  };
  queries({
    "quality:forLot": { rows: [corrected, original], hasMore: false },
  });
  render(<LotDetailPage lotId={lotId} />);
  expect(screen.getByText("Original inspection")).toBeVisible();
  expect(screen.getByText("Pending separate approval")).toBeVisible();
  expect(screen.getByText("2 %")).toBeVisible();
  expect(screen.getByText("3 %")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Propose correction" }));
  expect(screen.getByLabelText("Specification reference")).toHaveAttribute(
    "readonly",
  );
  expect(screen.getByLabelText("Specification version")).toHaveValue("1");
  await user.click(screen.getByRole("button", { name: "Close" }));
  mocks.mutate.mockResolvedValue(null);
  await user.click(screen.getByRole("button", { name: "Approve correction" }));
  expect(mocks.mutate).toHaveBeenCalledWith({ inspectionId: "inspection-2" });
});

it("requires an explicit inspection decision and restores focus after closing", async () => {
  const user = userEvent.setup();
  render(<InspectionForm lotId={lotId} city="Bengaluru" />);
  await user.click(screen.getByRole("button", { name: "Record inspection" }));
  await user.type(
    screen.getByLabelText("Specification reference"),
    "Actual buyer reference",
  );
  await user.type(screen.getByLabelText("Specification version"), "2026-10");
  await user.type(screen.getByLabelText("Sample method"), "Measured composite");
  await user.type(screen.getByLabelText("Parameter"), "Moisture");
  await user.type(screen.getByLabelText("Unit"), "%");
  await user.type(screen.getByLabelText("Measured value"), "2");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "complete each required field",
  );
  expect(mocks.mutate).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("combobox", { name: "Inspection decision" }),
  );
  await user.click(screen.getByRole("option", { name: "Conditional" }));
  mocks.mutate.mockResolvedValue("inspection-1");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(mocks.mutate).toHaveBeenCalledWith({
    lotId,
    buyerOrgId: undefined,
    specificationReference: "Actual buyer reference",
    specificationVersion: "2026-10",
    sampleMethod: "Measured composite",
    results: [{ parameter: "Moisture", unit: "%", value: "2" }],
    decision: "conditional",
    evidenceReference: undefined,
  });
  expect(
    screen.getByRole("button", { name: "Record inspection" }),
  ).toHaveFocus();
});

it("routes controlled material to disposition and keeps viewer controls hidden", () => {
  queries({
    "traceability:history": {
      ...history,
      lot: {
        ...lot,
        streamClass: "residual_waste",
        handlingClass: "controlled",
      },
    },
  });
  const view = render(<LotDetailPage lotId={lotId} />);
  expect(
    screen.queryByRole("button", { name: "Record transformation" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Record disposition" }),
  ).toBeVisible();
  view.unmount();
  render(<LotDetailPage lotId={lotId} />, "viewer");
  expect(
    screen.queryByRole("button", { name: "Record disposition" }),
  ).not.toBeInTheDocument();
});
it("prevents overdrawn disposition and preserves rejected evidence", async () => {
  const user = userEvent.setup();
  mocks.mutate.mockRejectedValue(
    new ConvexError("WORKSPACE_PERMISSION_DENIED"),
  );
  render(
    <RecordDisposition
      lotId={lotId}
      materialCode="PLASTIC-PET"
      availableGrams={100}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Record disposition" }));
  await user.type(screen.getByLabelText("Mass (g)"), "101");
  await user.type(
    screen.getByLabelText("Destination reference"),
    "Synthetic receiver",
  );
  await user.type(
    screen.getByLabelText("Authorisation reference"),
    "LOCAL-AUTH",
  );
  await user.type(
    screen.getByLabelText("Manifest reference"),
    "LOCAL-MANIFEST",
  );
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(mocks.mutate).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Mass (g)"));
  await user.type(screen.getByLabelText("Mass (g)"), "100");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(mocks.mutate).toHaveBeenCalledWith({
    lotId,
    grams: 100,
    destinationReference: "Synthetic receiver",
    authorisationReference: "LOCAL-AUTH",
    manifestReference: "LOCAL-MANIFEST",
  });
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByLabelText("Manifest reference")).toHaveValue(
    "LOCAL-MANIFEST",
  );
});

it("combines a selected held input while rejecting its overdrawn quantity", async () => {
  const user = userEvent.setup();
  queries({
    "traceability:mine": {
      rows: [
        lot,
        {
          ...lot,
          id: "lot-secondary",
          materialCode: "ADDITIVE",
          state: "Feedstock",
          availableGrams: 200,
        },
      ],
      hasMore: false,
    },
  });
  mocks.mutate.mockResolvedValue("combined-process");
  render(<TransformLot lotId={lotId} availableGrams={1000} />);
  await user.click(
    screen.getByRole("button", { name: "Record transformation" }),
  );
  await user.type(screen.getByLabelText("Input mass (g)"), "1000");
  await user.click(screen.getByRole("button", { name: "Add input lot" }));
  await user.click(
    screen.getByRole("combobox", { name: "Choose an input lot" }),
  );
  expect(
    screen.queryByRole("option", { name: "PET · Bale" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("option", { name: "ADDITIVE · Feedstock" }),
  );
  const inputs = within(
    screen.getByRole("region", { name: "Other input lots" }),
  );
  await user.type(inputs.getByLabelText("Mass (g)"), "201");
  const output = within(screen.getByRole("group", { name: "Output 1" }));
  await user.type(output.getByLabelText("Material code or name"), "COMPOUND");
  await user.type(output.getByLabelText("Physical state"), "Pellet");
  await user.type(output.getByLabelText("Mass (g)"), "1201");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(mocks.mutate).not.toHaveBeenCalled();
  await user.clear(inputs.getByLabelText("Mass (g)"));
  await user.type(inputs.getByLabelText("Mass (g)"), "200");
  await user.clear(output.getByLabelText("Mass (g)"));
  await user.type(output.getByLabelText("Mass (g)"), "1200");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(mocks.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      inputGrams: 1000,
      additionalInputs: [{ lotId: "lot-secondary", grams: 200 }],
    }),
  );
});

it("requires whole recorded paise and evidence while keeping a failed acquisition draft", async () => {
  const user = userEvent.setup();
  mocks.mutate
    .mockRejectedValueOnce(new Error("Temporary failure"))
    .mockResolvedValueOnce(lotId);
  render(<DeclareLot />);
  await user.click(screen.getByRole("button", { name: "Declare a lot" }));
  await user.type(screen.getByLabelText("Material code or name"), "PET");
  await user.type(screen.getByLabelText("Physical state"), "Bale");
  await user.type(screen.getByLabelText("Mass (g)"), "1001");
  await user.type(screen.getByLabelText(en.recordedCosts.acquisition), "٠");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(en.lots.required);
  expect(mocks.mutate).not.toHaveBeenCalled();
  await user.type(
    screen.getByLabelText(en.recordedCosts.reference),
    "Recorded acquisition evidence",
  );
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your values are kept",
  );
  expect(screen.getByLabelText(en.recordedCosts.acquisition)).toHaveValue("٠");
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(mocks.mutate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      acquisitionCostPaise: 0,
      costReference: "Recorded acquisition evidence",
    }),
  );
});

it("keeps a process retry key and exact recorded cost after a failed save", async () => {
  const user = userEvent.setup();
  mocks.mutate
    .mockRejectedValueOnce(new Error("Lost response"))
    .mockResolvedValueOnce("process-one");
  render(<TransformLot lotId={lotId} availableGrams={1000} />);
  await user.click(
    screen.getByRole("button", { name: "Record transformation" }),
  );
  await user.type(screen.getByLabelText("Input mass (g)"), "1000");
  const output = within(screen.getByRole("group", { name: "Output 1" }));
  await user.type(output.getByLabelText("Material code or name"), "PET");
  await user.type(output.getByLabelText("Physical state"), "Flake");
  await user.type(output.getByLabelText("Mass (g)"), "1000");
  await user.type(screen.getByLabelText(en.recordedCosts.processing), "٣");
  await user.type(
    screen.getByLabelText(en.recordedCosts.reference),
    "Recorded process evidence",
  );
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your values are kept",
  );
  await user.click(screen.getByRole("button", { name: "Save record" }));
  expect(mocks.mutate).toHaveBeenCalledTimes(2);
  expect(mocks.mutate.mock.calls[1]).toEqual(mocks.mutate.mock.calls[0]);
  expect(mocks.mutate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      processingCostPaise: 3,
      operationReference: expect.any(String),
    }),
  );
});
