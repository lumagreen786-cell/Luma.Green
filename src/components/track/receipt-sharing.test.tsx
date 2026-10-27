import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { CollectionSharing, ReceiptReview } from "./receipt-sharing";
import type { TrackedBooking } from "./types";

const mutation = vi.hoisted(() => vi.fn());
const read = vi.hoisted(() => vi.fn());
const errorToast = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({
  useMutation: () => mutation,
  useQuery: read,
}));
vi.mock("sonner", () => ({ toast: { error: errorToast } }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
    >
      {children}
    </NextIntlClientProvider>
  );
}
const booking: TrackedBooking = {
  token: "private-booking",
  status: "completed",
  mode: "pickup",
  slotDate: "2026-10-27",
  slotWindow: "morning",
  timeline: [],
  items: [],
  shop: { name: "Collection shop", area: "Bengaluru", address: "Test fixture" },
  isMine: true,
  canCancel: false,
  createdAt: 1,
  receipt: {
    lines: [
      {
        material: {
          code: "PAPER-NEWS",
          names: { en: "Paper" },
          family: "paper",
        },
        grams: 1250,
        paisePerKg: 1400,
        paise: 1750,
      },
    ],
    totalPaise: 1750,
    method: "cash",
    paidAt: 100,
  },
};
beforeEach(() => {
  mutation.mockReset();
  mutation.mockResolvedValue(null);
  read.mockReset();
  errorToast.mockReset();
});

it("separates receipt acceptance from payment acknowledgement", async () => {
  const view = render(<ReceiptReview booking={booking} />, { wrapper });
  expect(
    screen.queryByRole("button", { name: messages.track.review.acknowledge }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: messages.track.review.accept }),
  );
  expect(mutation).toHaveBeenCalledExactlyOnceWith({
    token: booking.token,
    receiptVersion: 100,
    decision: "accepted",
    rejectedLineIndexes: [],
  });
  view.rerender(
    <ReceiptReview
      booking={{
        ...booking,
        receiptReview: {
          receiptVersion: 100,
          decision: "accepted",
          rejectedLineIndexes: [],
          acceptedGrams: 1250,
          acceptedPaise: 1750,
          reviewedAt: 101,
        },
      }}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.track.review.acknowledge }),
  );
  expect(mutation).toHaveBeenLastCalledWith({
    token: booking.token,
    receiptVersion: 100,
  });
});

it("keeps a rejected line in the dispute and requires a reason", async () => {
  render(<ReceiptReview booking={booking} />, { wrapper });
  const dispute = screen.getByRole("button", {
    name: messages.track.review.dispute,
  });
  expect(dispute).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox", { name: "Reject Paper" }));
  expect(
    screen.getByRole("button", { name: messages.track.review.accept }),
  ).toBeDisabled();
  await userEvent.type(
    screen.getByRole("textbox", { name: messages.track.review.note }),
    "Weight does not match the scale.",
  );
  await userEvent.click(dispute);
  expect(mutation).toHaveBeenCalledExactlyOnceWith({
    token: booking.token,
    receiptVersion: 100,
    decision: "disputed",
    rejectedLineIndexes: [0],
    note: "Weight does not match the scale.",
  });
});

it("shows failed saves and does not turn failure into acceptance", async () => {
  mutation.mockRejectedValue(new Error("Access revoked"));
  render(<ReceiptReview booking={booking} />, { wrapper });
  await userEvent.click(
    screen.getByRole("button", { name: messages.track.review.accept }),
  );
  expect(errorToast).toHaveBeenCalledWith(messages.track.review.error);
  expect(
    screen.getByRole("button", { name: messages.track.review.accept }),
  ).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: messages.track.review.acknowledge }),
  ).not.toBeInTheDocument();
});

it("requires adult confirmation for an invitation and gives the helper a leave action", async () => {
  const view = render(<CollectionSharing token={booking.token} owner open />, {
    wrapper,
  });
  await userEvent.type(
    screen.getByRole("textbox", { name: messages.track.review.phone }),
    "9876500051",
  );
  expect(
    screen.getByRole("button", { name: messages.track.review.invite }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole("checkbox", { name: messages.track.review.adult }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.track.review.invite }),
  );
  expect(mutation).toHaveBeenCalledWith({
    token: booking.token,
    phone: "9876500051",
    adultConfirmed: true,
  });
  read.mockReturnValue([
    { id: "fixture-invitation", active: true, accepted: true, expiresAt: 1000 },
  ]);
  view.rerender(<CollectionSharing token={booking.token} owner={false} open />);
  const region = screen.getByRole("region", {
    name: messages.track.review.sharing,
  });
  expect(
    within(region).queryByRole("button", {
      name: messages.track.review.invite,
    }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    within(region).getByRole("button", { name: messages.track.review.leave }),
  );
  expect(mutation).toHaveBeenLastCalledWith({
    invitationId: "fixture-invitation",
  });
});
