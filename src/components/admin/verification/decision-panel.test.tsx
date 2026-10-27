import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../../../convex/_generated/dataModel";
import { DecisionPanel, type DecisionSubject } from "./decision-panel";

const decide = vi.fn();
const push = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => decide,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const shop: DecisionSubject = {
  id: "k17kavitha" as Id<"applications">,
  name: "Kavitha Raddi Shop",
  kind: "kabadiwala",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DecisionPanel", () => {
  it("keeps Approve locked until every check is ticked", () => {
    const { rerender } = render(
      <DecisionPanel subject={shop} canApprove={false} />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(
      screen.getByText("Tick every check above to approve."),
    ).toBeInTheDocument();

    rerender(<DecisionPanel subject={shop} canApprove />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("won't send an application back without a note", async () => {
    const user = userEvent.setup();
    render(<DecisionPanel subject={shop} canApprove={false} />);
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));

    const dialog = screen.getByRole("dialog", {
      name: "Ask Kavitha Raddi Shop for changes",
    });
    await user.type(
      within(dialog).getByLabelText("What should they change?"),
      "ok",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Send back for changes" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Write a note of at least 5 characters",
    );
    expect(decide).not.toHaveBeenCalled();
  });

  it("sends the note, then goes back to the queue", async () => {
    decide.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<DecisionPanel subject={shop} canApprove={false} />);
    await user.click(screen.getByRole("button", { name: "Ask for changes" }));
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText("What should they change?"),
      "  Move the map pin to your shop.  ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Send back for changes" }),
    );

    expect(decide).toHaveBeenCalledWith({
      applicationId: shop.id,
      decision: "changes",
      note: "Move the map pin to your shop.",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Sent back to Kavitha Raddi Shop with your note.",
    );
    expect(push).toHaveBeenCalledWith("/admin/verification");
  });

  it("says why, and stays put, when the decision is refused", async () => {
    decide.mockRejectedValue(new ConvexError("WRONG_STATE"));
    const user = userEvent.setup();
    render(<DecisionPanel subject={shop} canApprove />);
    await user.click(screen.getByRole("button", { name: "Approve" }));

    const dialog = screen.getByRole("dialog", {
      name: "Approve Kavitha Raddi Shop?",
    });
    expect(dialog).toHaveTextContent("today's fallback prices");
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    expect(decide).toHaveBeenCalledWith({
      applicationId: shop.id,
      decision: "approve",
      note: undefined,
    });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "already been decided",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("warns before a rejection, which always needs a reason", async () => {
    const user = userEvent.setup();
    render(<DecisionPanel subject={shop} canApprove={false} />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", {
      name: "Reject Kavitha Raddi Shop?",
    });
    expect(
      within(dialog).getByLabelText("Why are you rejecting it?"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it("keeps an embedded review open after the server saves a decision", async () => {
  decide.mockResolvedValue(null);
  const onDecided = vi.fn();
  const user = userEvent.setup();
  render(<DecisionPanel subject={shop} canApprove onDecided={onDecided} />);
  await user.click(screen.getByRole("button", { name: "Approve" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Approve",
    }),
  );
  expect(onDecided).toHaveBeenCalledOnce();
  expect(push).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
