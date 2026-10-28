import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FunctionReference, getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, expect, it, vi } from "vitest";

import { AccountRemovals } from "./account-removals";

const mocks = vi.hoisted(() => ({
  queue: [] as {
    id: string;
    state: string;
    createdAt: number;
    lastError?: string;
  }[],
  record: vi.fn(),
  retry: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => mocks.queue,
  useMutation: (fn: FunctionReference<"mutation">) =>
    getFunctionName(fn).endsWith(":recordReview") ? mocks.record : mocks.retry,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.queue = [];
  mocks.record.mockResolvedValue(null);
  mocks.retry.mockResolvedValue(null);
});
it("shows a bounded review queue with no claim of complete erasure", () => {
  render(<AccountRemovals />);
  expect(screen.getByText("No requests waiting for review.")).toBeVisible();
  expect(
    screen.getByText(
      /Recording a review does not mean that all data was erased/,
    ),
  ).toBeVisible();
});
it("requires an external evidence reference, preserves it on refusal and records the exact request", async () => {
  mocks.queue = [
    {
      id: "synthetic-removal-review",
      state: "restricted_review",
      createdAt: 1,
    },
  ];
  mocks.record
    .mockRejectedValueOnce(new ConvexError("TWO_FACTOR_REQUIRED"))
    .mockResolvedValueOnce(null);
  render(<AccountRemovals />);
  const action = screen.getByRole("button", { name: "Record review" });
  expect(action).toBeDisabled();
  const input = screen.getByLabelText(
    "External retained-evidence review reference",
  );
  await userEvent.type(input, "External review evidence reference");
  await userEvent.click(action);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your admin session has ended",
  );
  expect(input).toHaveValue("External review evidence reference");
  await userEvent.click(action);
  expect(mocks.record).toHaveBeenLastCalledWith({
    requestId: "synthetic-removal-review",
    reference: "External review evidence reference",
  });
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Required evidence remains retained",
  );
  expect(input).toHaveValue("");
  expect(mocks.retry).not.toHaveBeenCalled();
});
it("offers retry only for failed cleanup and hides internal failure codes", async () => {
  mocks.queue = [
    {
      id: "synthetic-removal-pending",
      state: "access_closed",
      createdAt: 1,
      lastError: "CLEANUP_RETRY_REQUIRED",
    },
    { id: "synthetic-removal-running", state: "cleanup_running", createdAt: 2 },
    {
      id: "synthetic-removal-failed",
      state: "cleanup_running",
      createdAt: 3,
      lastError: "CLEANUP_RETRY_REQUIRED",
    },
  ];
  render(<AccountRemovals />);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByText("CLEANUP_RETRY_REQUIRED")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Retry cleanup" })).toHaveLength(
    1,
  );
  await userEvent.click(screen.getByRole("button", { name: "Retry cleanup" }));
  await waitFor(() => {
    expect(mocks.retry).toHaveBeenCalledWith({
      requestId: "synthetic-removal-failed",
    });
  });
  expect(mocks.record).not.toHaveBeenCalled();
});
