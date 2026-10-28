import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FunctionReturnType, getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { StockClosing } from "./stock-closing";

type Board = FunctionReturnType<typeof api.stockClosing.board>;
const state = vi.hoisted(() => ({
  record: vi.fn(),
  configure: vi.fn(),
  adjust: vi.fn(),
  success: vi.fn(),
  user: "account-one",
  board: null as Board | null,
}));
vi.mock("convex/react", () => ({
  useQuery: () => state.board,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name === "stockClosing:record") return state.record;
    return name === "stockClosing:configure" ? state.configure : state.adjust;
  },
}));
vi.mock("./use-shop", () => ({
  useBusiness: () => ({ id: state.board?.orgId }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: state.user } } }) },
}));
vi.mock("sonner", () => ({ toast: { success: state.success } }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T06:00:00Z"));
  vi.clearAllMocks();
  state.record.mockReset().mockResolvedValue("closing-one");
  state.configure.mockReset().mockResolvedValue(null);
  state.adjust.mockReset().mockResolvedValue("adjustment-one");
  state.user = "account-one";
  state.board = {
    orgId: "workspace-one" as Id<"orgs">,
    canOperate: true,
    canAdjust: false,
    adjustments: [],
    latest: null,
    settings: [],
    alerts: [],
    materials: [
      { code: "PAPER-NEWS", names: { en: "Newspaper" }, family: "paper" },
    ],
  };
});
afterEach(() => vi.useRealTimers());
function Example() {
  return (
    <NextIntlClientProvider locale="en" messages={messages} now={new Date()}>
      <StockClosing />
    </NextIntlClientProvider>
  );
}
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText(messages.stockClosing.title));
}
it.each(["INVALID_CLOSING", "STOCK_LEDGER_MISMATCH", "STOCK_CLOSING_LIMIT"])(
  "allows correction after the server definitively rejects a closing with %s",
  async (code) => {
    state.record.mockRejectedValueOnce(new ConvexError(code));
    const user = userEvent.setup();
    render(<Example />);
    await open(user);
    const note = screen.getByLabelText(messages.stockClosing.note);
    await user.type(note, "Original review note");
    await user.click(
      screen.getByRole("button", { name: messages.stockClosing.record }),
    );
    await screen.findByRole("alert");
    expect(note).toBeEnabled();
    expect(note).toHaveValue("Original review note");
    await user.clear(note);
    await user.type(note, "Corrected review note");
    await user.click(
      screen.getByRole("button", { name: messages.stockClosing.record }),
    );
    await waitFor(() => {
      expect(state.success).toHaveBeenCalledOnce();
    });
    expect(state.record.mock.calls[1]?.[0]).toMatchObject({
      note: "Corrected review note",
    });
    expect(state.record.mock.calls[1]?.[0]).not.toEqual(
      state.record.mock.calls[0]?.[0],
    );
  },
);
it("retries an ambiguous closing response with the same immutable request and preserves the note", async () => {
  state.record.mockRejectedValueOnce(new Error("Connection lost"));
  const user = userEvent.setup();
  render(<Example />);
  await open(user);
  await user.type(
    screen.getByLabelText(messages.stockClosing.note),
    "Observed stock checked",
  );
  await user.click(
    screen.getByRole("button", { name: messages.stockClosing.record }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.common.error,
  );
  expect(screen.getByLabelText(messages.stockClosing.note)).toHaveValue(
    "Observed stock checked",
  );
  expect(screen.getByLabelText(messages.stockClosing.note)).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: messages.stockClosing.record }),
  );
  await waitFor(() => {
    expect(state.success).toHaveBeenCalledWith(messages.stockClosing.closed);
  });
  expect(state.record.mock.calls[1]?.[0]).toEqual(
    state.record.mock.calls[0]?.[0],
  );
});
it("starts a fresh current-day request only after a definitive date rejection without losing the note", async () => {
  state.record.mockRejectedValueOnce(new ConvexError("CLOSING_DATE_CHANGED"));
  const user = userEvent.setup();
  render(<Example />);
  await open(user);
  await user.type(
    screen.getByLabelText(messages.stockClosing.note),
    "Review for the current date",
  );
  await user.click(
    screen.getByRole("button", { name: messages.stockClosing.record }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.stockClosing.dateChanged,
  );
  expect(screen.getByLabelText(messages.stockClosing.note)).toBeEnabled();
  vi.setSystemTime(new Date("2026-10-28T18:30:00Z"));
  await user.click(
    screen.getByRole("button", { name: messages.stockClosing.record }),
  );
  await waitFor(() => {
    expect(state.record).toHaveBeenCalledTimes(2);
  });
  expect(state.record.mock.calls[1]?.[0]).toMatchObject({
    day: "2026-10-29",
    note: "Review for the current date",
  });
  expect(state.record.mock.calls[1]?.[0].operationKey).not.toBe(
    state.record.mock.calls[0]?.[0].operationKey,
  );
});
it.each([
  ["STOCK_CLOSING_LIMIT", "limit"],
  ["STOCK_LEDGER_MISMATCH", "mismatch"],
] as const)(
  "reports %s without claiming a successful closing",
  async (code, key) => {
    state.record.mockRejectedValue(new ConvexError(code));
    const user = userEvent.setup();
    render(<Example />);
    await open(user);
    await user.click(
      screen.getByRole("button", { name: messages.stockClosing.record }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      messages.stockClosing[key],
    );
    expect(state.success).not.toHaveBeenCalled();
  },
);
it("requires an explicit threshold and opt-in, normalizes supported digits and keeps the exact grams", async () => {
  const user = userEvent.setup();
  render(<Example />);
  await open(user);
  expect(
    screen.getByRole("checkbox", { name: messages.stockClosing.enabled }),
  ).not.toBeChecked();
  await user.click(
    screen.getByRole("combobox", { name: messages.stockClosing.material }),
  );
  await user.click(screen.getByRole("option", { name: "Newspaper" }));
  await user.type(screen.getByLabelText(messages.stockClosing.grams), "١٠٠١");
  await user.click(
    screen.getByRole("checkbox", { name: messages.stockClosing.enabled }),
  );
  await user.click(
    screen.getByRole("button", { name: messages.stockClosing.save }),
  );
  await waitFor(() => {
    expect(state.configure).toHaveBeenCalledWith({
      materialCode: "PAPER-NEWS",
      enabled: true,
      thresholdGrams: 1001,
    });
  });
});

it("requires owner correction evidence and explicitly chosen unknown cost without editing a historic record", async () => {
  if (!state.board) throw new Error("Missing board");
  state.board = { ...state.board, canAdjust: true };
  const user = userEvent.setup();
  render(<Example />);
  await open(user);
  const form = within(
    screen.getByRole("form", { name: messages.stockClosing.correction }),
  );
  await user.click(
    form.getByRole("combobox", { name: messages.stockClosing.material }),
  );
  await user.click(screen.getByRole("option", { name: "Newspaper" }));
  await user.type(form.getByLabelText(messages.sourcing.quantity), "١٠٠١");
  await user.type(
    form.getByLabelText(messages.tradeLifecycle.reason),
    "Physical count corrected",
  );
  await user.type(
    form.getByLabelText(messages.stockClosing.evidence),
    "Weighing sheet reference",
  );
  expect(
    form.getByLabelText(messages.recordedCosts.acquisition),
  ).toBeRequired();
  expect(
    form.getByRole("checkbox", { name: messages.stockClosing.unknown }),
  ).not.toBeChecked();
  await user.click(
    form.getByRole("checkbox", { name: messages.stockClosing.unknown }),
  );
  await user.click(form.getByRole("button", { name: messages.common.save }));
  await waitFor(() => {
    expect(state.adjust).toHaveBeenCalledWith(
      expect.objectContaining({
        materialCode: "PAPER-NEWS",
        deltaGrams: 1001,
        costPaise: null,
        reason: "Physical count corrected",
        evidenceReference: "Weighing sheet reference",
      }),
    );
  });
});
it("shows a saved closing without write controls for a viewer and clears unsaved notes across accounts", async () => {
  const user = userEvent.setup();
  const view = render(<Example />);
  await open(user);
  await user.type(
    screen.getByLabelText(messages.stockClosing.note),
    "Account one private note",
  );
  state.user = "account-two";
  view.rerender(<Example />);
  await open(user);
  expect(screen.getByLabelText(messages.stockClosing.note)).toHaveValue("");
  if (!state.board) throw new Error("Missing board");
  state.board = {
    ...state.board,
    canOperate: false,
    latest: {
      id: "closing-one" as Id<"stockDailyClosings">,
      day: "2026-10-28",
      note: "Saved review",
      lines: [{ materialCode: "PAPER-NEWS", grams: 1001, costPaise: null }],
      totalGrams: 1001,
      totalCostPaise: null,
      createdAt: Date.now(),
    },
  };
  view.rerender(<Example />);
  expect(screen.getByText("Saved review")).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getAllByText(/Unknown cost/)[0]).toBeVisible();
});
