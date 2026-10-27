import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { CollectionReassignment } from "./collection-reassignment";

const state = vi.hoisted(() => ({
  reassign: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({
    bookings: [{ id: "booking-one", label: "Tomorrow · morning · abcd" }],
    shops: [{ id: "shop-two", label: "Receiving shop · North" }],
  }),
  useMutation: () => state.reassign,
}));
vi.mock("sonner", () => ({
  toast: { success: state.success, error: state.error },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Collection" }));
  await user.click(
    screen.getByRole("option", { name: "Tomorrow · morning · abcd" }),
  );
  await user.click(
    screen.getByRole("combobox", { name: "New collection shop" }),
  );
  await user.click(
    screen.getByRole("option", { name: "Receiving shop · North" }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Reason" }),
    "Original shop cannot attend",
  );
}

it("sends the selected offer and reason, then clears the completed form", async () => {
  state.reassign.mockResolvedValue(null);
  const user = userEvent.setup();
  render(<CollectionReassignment />);
  expect(screen.getByRole("button", { name: "Send new offer" })).toBeDisabled();
  await fillForm(user);
  await user.click(screen.getByRole("button", { name: "Send new offer" }));
  await waitFor(() => {
    expect(state.success).toHaveBeenCalledOnce();
  });
  expect(state.reassign).toHaveBeenCalledWith({
    bookingId: "booking-one",
    orgId: "shop-two",
    reason: "Original shop cannot attend",
  });
  expect(screen.getByRole("textbox", { name: "Reason" })).toHaveValue("");
  expect(screen.getByRole("button", { name: "Send new offer" })).toBeDisabled();
});

it("keeps selections and the reason when the server rejects an ineligible offer", async () => {
  state.reassign.mockRejectedValue(new Error("SLOT_UNAVAILABLE"));
  const user = userEvent.setup();
  render(<CollectionReassignment />);
  await fillForm(user);
  await user.click(screen.getByRole("button", { name: "Send new offer" }));
  await waitFor(() => {
    expect(state.error).toHaveBeenCalledOnce();
  });
  expect(screen.getByRole("textbox", { name: "Reason" })).toHaveValue(
    "Original shop cannot attend",
  );
  expect(
    screen.getByRole("combobox", { name: "Collection" }),
  ).toHaveTextContent("Tomorrow");
  expect(
    screen.getByRole("combobox", { name: "New collection shop" }),
  ).toHaveTextContent("Receiving shop");
  expect(screen.getByRole("button", { name: "Send new offer" })).toBeEnabled();
});
