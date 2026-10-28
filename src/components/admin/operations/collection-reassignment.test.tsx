import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";

import { CollectionReassignment } from "./collection-reassignment";

const state = vi.hoisted(() => ({
  choices: "ready",
  reassign: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (getFunctionName(reference).endsWith(":board"))
      return {
        bookings: [
          { id: "booking-one", label: "Tomorrow · morning · abcd" },
          { id: "booking-two", label: "Tomorrow · afternoon · efgh" },
        ],
        shops: [{ id: "shop-two", label: "Receiving shop · North" }],
      };
    if (args === "skip" || state.choices === "loading") return;
    if (state.choices === "unknown") return { city: null, shops: [] };
    if (state.choices === "empty")
      return { city: "New Delhi, Delhi", shops: [] };
    return {
      city: "New Delhi, Delhi",
      shops: [{ id: "shop-two", label: "Receiving shop · North" }],
    };
  },
  useMutation: () => state.reassign,
}));
vi.mock("sonner", () => ({
  toast: { success: state.success, error: state.error },
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.choices = "ready";
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

it("clears the selected shop when the booking changes", async () => {
  const user = userEvent.setup();
  render(<CollectionReassignment />);
  await fillForm(user);
  await user.click(screen.getByRole("combobox", { name: "Collection" }));
  await user.click(
    screen.getByRole("option", { name: "Tomorrow · afternoon · efgh" }),
  );
  expect(
    screen.getByRole("combobox", { name: "New collection shop" }),
  ).toHaveTextContent("Choose shop");
  expect(screen.getByRole("button", { name: "Send new offer" })).toBeDisabled();
});

it.each(["loading", "unknown", "empty"] as const)(
  "keeps %s local choices unavailable without a selected shop",
  async (status) => {
    state.choices = status;
    const user = userEvent.setup();
    render(<CollectionReassignment />);
    expect(
      screen.getByText(
        "Choose a collection to load shops in its recorded locality.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Collection" }));
    await user.click(
      screen.getByRole("option", { name: "Tomorrow · morning · abcd" }),
    );
    expect(
      screen.getByRole("combobox", { name: "New collection shop" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Send new offer" }),
    ).toBeDisabled();
    const messages = {
      loading: "Loading local shops…",
      unknown:
        "The collection locality is unknown. Confirm it before reassignment.",
      empty: "No other pickup shop is available in this recorded locality.",
    };
    expect(screen.getByText(messages[status])).toBeInTheDocument();
  },
);
