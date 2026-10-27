import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FunctionReturnType, getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { EmployerHandovers, WorkerHandovers } from "./worker-handovers";

type Board = FunctionReturnType<typeof api.workerHandovers.employerBoard>;
type Row = Board["rows"][number];
const state = vi.hoisted(() => ({
  bind: vi.fn(),
  record: vi.fn(),
  ack: vi.fn(),
  revoke: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  user: "worker-one",
  today: "2026-10-28",
  org: "shop-one",
  employer: null as Board | null,
  worker: [] as Row[],
}));
vi.mock("convex/react", () => ({
  useQuery: () => state.employer,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(reference)) {
      case "workerHandovers:bind": {
        return state.bind;
      }
      case "workerHandovers:recordCollected": {
        return state.record;
      }
      case "workerHandovers:acknowledge": {
        return state.ack;
      }
      default: {
        return state.revoke;
      }
    }
  },
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: () => state.worker,
}));
vi.mock("@/components/shop/use-shop", () => ({
  useBusiness: () => ({ kind: "kabadiwala", id: state.org }),
  useIndiaToday: () => state.today,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: state.user } } }) },
}));
vi.mock("sonner", () => ({
  toast: { success: state.success, error: state.error },
}));
function row(values: Partial<Row> = {}): Row {
  return {
    id: "handover-one" as Id<"workerHandovers">,
    jobId: "job-one" as Id<"jobs">,
    bookingId: "booking-one" as Id<"bookings">,
    jobTitle: "Isolated assigned pickup",
    jobDate: "2026-10-28",
    bookingReference: "2026-10-28 · morning · 0001",
    employerName: "Isolated shop",
    collectedGrams: null,
    receivedGrams: null,
    varianceGrams: null,
    evidenceReference: null,
    varianceReason: null,
    boundByProfileId: "employer-profile" as Id<"profiles">,
    workerProfileId: "worker-profile" as Id<"profiles">,
    collectedByProfileId: null,
    acknowledgedByProfileId: null,
    collectedAt: null,
    acknowledgedAt: null,
    revoked: false,
    canCollect: false,
    canAcknowledge: false,
    canRevoke: false,
    ...values,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.bind.mockReset().mockResolvedValue("handover-one");
  state.record.mockReset().mockResolvedValue(null);
  state.ack.mockReset().mockResolvedValue(null);
  state.revoke.mockReset().mockResolvedValue(null);
  state.user = "worker-one";
  state.today = "2026-10-28";
  state.org = "shop-one";
  state.worker = [row({ canCollect: true })];
  state.employer = {
    canOperate: true,
    rows: [],
    jobs: [{ id: "job-one" as Id<"jobs">, label: "Isolated assigned pickup" }],
    bookings: [
      {
        id: "booking-one" as Id<"bookings">,
        label: "2026-10-28 · morning · 0001",
      },
    ],
  };
});
function Example({ employer = false }: { employer?: boolean }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      now={new Date("2026-10-28T06:00:00Z")}
    >
      {employer ? <EmployerHandovers /> : <WorkerHandovers />}
    </NextIntlClientProvider>
  );
}
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText(messages.workerHandover.title));
}
it("lets the assigned worker record exact supported digits and an evidence reference without rates or payment fields", async () => {
  const user = userEvent.setup();
  render(<Example />);
  await open(user);
  await user.type(
    screen.getByLabelText(messages.workerHandover.collected),
    "١٠٠١",
  );
  await user.type(
    screen.getByLabelText(messages.workerHandover.evidence),
    "Measured weighing reference",
  );
  await user.click(
    screen.getByRole("button", { name: messages.workerHandover.record }),
  );
  await waitFor(() => {
    expect(state.record).toHaveBeenCalledWith(
      expect.objectContaining({
        handoverId: "handover-one",
        collectedGrams: 1001,
        evidenceReference: "Measured weighing reference",
      }),
    );
  });
  expect(
    screen.queryByLabelText(/price|rate|payment/i),
  ).not.toBeInTheDocument();
});
it("binds the actual chosen job and source booking", async () => {
  const user = userEvent.setup();
  render(<Example employer />);
  await open(user);
  await user.click(
    screen.getByRole("combobox", { name: messages.workerHandover.job }),
  );
  await user.click(
    screen.getByRole("option", { name: "Isolated assigned pickup" }),
  );
  await user.click(
    screen.getByRole("combobox", { name: messages.workerHandover.collection }),
  );
  await user.click(
    screen.getByRole("option", { name: "2026-10-28 · morning · 0001" }),
  );
  await user.click(
    screen.getByRole("button", { name: messages.workerHandover.link }),
  );
  await waitFor(() => {
    expect(state.bind).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-one", bookingId: "booking-one" }),
    );
  });
});
it("shows canonical received mass and requires a variance reason without sending a caller-selected received weight", async () => {
  if (!state.employer) throw new Error("Missing board");
  state.employer = {
    ...state.employer,
    canOperate: true,
    rows: [
      row({
        collectedGrams: 1001,
        receivedGrams: 1000,
        varianceGrams: -1,
        canAcknowledge: true,
      }),
    ],
  };
  const user = userEvent.setup();
  render(<Example employer />);
  await open(user);
  const form = within(
    screen.getByRole("form", { name: messages.workerHandover.acknowledge }),
  );
  expect(
    form.getByRole("button", { name: messages.workerHandover.acknowledge }),
  ).toBeDisabled();
  await user.type(
    form.getByLabelText(messages.workerHandover.reason),
    "Scale readings differed",
  );
  await user.click(
    form.getByRole("button", { name: messages.workerHandover.acknowledge }),
  );
  await waitFor(() => {
    expect(state.ack).toHaveBeenCalledWith(
      expect.objectContaining({
        handoverId: "handover-one",
        varianceReason: "Scale readings differed",
      }),
    );
  });
  expect(
    Object.keys(state.ack.mock.calls[0]?.[0] as object).toSorted((a, b) =>
      a.localeCompare(b),
    ),
  ).toEqual(["handoverId", "operationKey", "varianceReason"]);
});
it("preserves immutable measurement retries after ambiguous failures", async () => {
  state.record.mockRejectedValueOnce(new Error("Disconnected"));
  const user = userEvent.setup();
  render(<Example />);
  await open(user);
  await user.type(
    screen.getByLabelText(messages.workerHandover.collected),
    "1001",
  );
  await user.type(
    screen.getByLabelText(messages.workerHandover.evidence),
    "Weighing reference",
  );
  await user.click(
    screen.getByRole("button", { name: messages.workerHandover.record }),
  );
  await waitFor(() => {
    expect(state.error).toHaveBeenCalledOnce();
  });
  expect(
    screen.getByLabelText(messages.workerHandover.collected),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: messages.workerHandover.record }),
  );
  await waitFor(() => {
    expect(state.record).toHaveBeenCalledTimes(2);
  });
  expect(state.record.mock.calls[1]?.[0]).toEqual(
    state.record.mock.calls[0]?.[0],
  );
});
it("keeps read-only evidence visible without mutation controls", async () => {
  if (!state.employer) throw new Error("Missing board");
  state.employer = {
    ...state.employer,
    canOperate: false,
    rows: [
      row({ collectedGrams: 1001, receivedGrams: 1000, varianceGrams: -1 }),
    ],
  };
  const user = userEvent.setup();
  render(<Example employer />);
  await open(user);
  expect(
    screen.getByRole("heading", { name: "Isolated assigned pickup" }),
  ).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("clears unsaved worker evidence when the account changes", async () => {
  const user = userEvent.setup();
  const view = render(<Example />);
  await open(user);
  await user.type(
    screen.getByLabelText(messages.workerHandover.evidence),
    "Private first-account evidence",
  );
  state.user = "worker-two";
  view.rerender(<Example />);
  await open(user);
  expect(screen.getByLabelText(messages.workerHandover.evidence)).toHaveValue(
    "",
  );
});

it("opens the measured-weight control on the scheduled day without requiring another record to change", async () => {
  state.worker = [row({ canCollect: true, jobDate: "2026-10-29" })];
  const user = userEvent.setup();
  const view = render(<Example />);
  await open(user);
  expect(
    screen.queryByLabelText(messages.workerHandover.collected),
  ).not.toBeInTheDocument();
  state.today = "2026-10-29";
  view.rerender(<Example />);
  expect(
    screen.getByLabelText(messages.workerHandover.collected),
  ).toBeVisible();
});
