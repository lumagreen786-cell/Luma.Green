import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { TrackNotFound } from "./track-page";
import { TrackView } from "./track-view";
import type { TrackedBooking } from "./types";

const auth = vi.hoisted(() => ({ isLoading: false, isAuthenticated: false }));
const cancel = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useConvexAuth: () => auth,
  useMutation: () => cancel,
  useQuery: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
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
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { session: { id: "fixture-session" } } }),
    signOut: vi.fn(),
    phoneNumber: { sendOtp: vi.fn(), verify: vi.fn() },
  },
}));

function withIntl(children: ReactNode) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
      onError={(error) => {
        throw error;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

const newspaper = {
  code: "PAPER-NEWS",
  names: { en: "Newspaper" },
  family: "paper" as const,
};

function booking(overrides: Partial<TrackedBooking> = {}): TrackedBooking {
  const base: TrackedBooking = {
    token: "k7q2m9xw4c",
    status: "requested",
    mode: "pickup",
    slotDate: "2026-10-01",
    slotWindow: "morning",
    timeline: [{ status: "requested", at: Date.UTC(2026, 8, 29, 6) }],
    items: [{ material: newspaper, estKg: 12 }],
    estimatePaise: 17_400,
    shop: {
      name: "Ramesh Kabadi Store",
      area: "Yeshwanthpur",
      address: "12, 4th Cross, Yeshwanthpur, Bengaluru",
      phone: "+919000000101",
      hours: { opens: "08:00", closes: "20:00" },
    },
    receipt: undefined,
    points: undefined,
    isMine: true,
    canCancel: true,
    createdAt: Date.UTC(2026, 8, 29, 6),
  };
  return Object.assign(base, overrides);
}

beforeEach(() => {
  auth.isAuthenticated = false;
  cancel.mockReset();
  push.mockReset();
});

describe("TrackView", () => {
  it("says who it's waiting for, what it's worth and how to reach the shop", () => {
    render(withIntl(<TrackView booking={booking()} />));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Waiting for Ramesh Kabadi Store to accept",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("You'll get about ₹174")).toBeInTheDocument();
    expect(
      screen.getByText("About +17 recycle points after weighing"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Call Ramesh Kabadi Store" }),
    ).toHaveAttribute("href", "tel:+919000000101");
    expect(screen.getByText("About 12 kg")).toBeInTheDocument();
  });

  it("explains reassignment without losing the current shop details", () => {
    render(
      withIntl(
        <TrackView
          booking={booking({
            dispatch: {
              attempt: 2,
              offeredAt: Date.now(),
              approximateLocation: true,
            },
          })}
        />,
      ),
    );
    expect(
      screen.getByText(/Your request has moved to another nearby shop/),
    ).toHaveAttribute("role", "status");
    expect(
      screen.getByRole("link", { name: "Call Ramesh Kabadi Store" }),
    ).toBeInTheDocument();
  });

  it("lets the household that booked cancel, after asking", async () => {
    auth.isAuthenticated = true;
    render(withIntl(<TrackView booking={booking({ isMine: true })} />));
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel booking" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Cancel this booking?" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    expect(cancel).toHaveBeenCalledWith({ token: "k7q2m9xw4c" });
  });

  it("does not show financial controls to a collection helper", () => {
    render(
      withIntl(
        <TrackView booking={booking({ isMine: false, canCancel: false })} />,
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Accept" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Invite helper" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("You'll get about ₹174")).not.toBeInTheDocument();
  });

  it("hides cancelling from someone else who is signed in", () => {
    auth.isAuthenticated = true;
    render(
      withIntl(
        <TrackView booking={booking({ isMine: false, canCancel: false })} />,
      ),
    );
    expect(
      screen.queryByRole("button", { name: "Cancel booking" }),
    ).not.toBeInTheDocument();
  });

  it("shows what was weighed and paid once it's done", () => {
    render(
      withIntl(
        <TrackView
          booking={booking({
            status: "completed",
            canCancel: false,
            points: 16,
            timeline: [
              { status: "requested", at: Date.UTC(2026, 8, 20, 4) },
              { status: "accepted", at: Date.UTC(2026, 8, 20, 5) },
              { status: "completed", at: Date.UTC(2026, 8, 20, 7) },
            ],
            receipt: {
              lines: [
                {
                  material: newspaper,
                  grams: 11_640,
                  paisePerKg: 1450,
                  paise: 16_878,
                },
              ],
              totalPaise: 16_878,
              method: "upi",
              paidAt: Date.UTC(2026, 8, 20, 7),
            },
          })}
        />,
      ),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Review the receipt" }),
    ).toBeInTheDocument();
    expect(screen.getByText("+16 recycle points")).toBeInTheDocument();
    expect(screen.getByText("11.6 kg at ₹14.50/kg")).toBeInTheDocument();
    expect(screen.queryByText("Weighed and paid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm payment received" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel booking" }),
    ).not.toBeInTheDocument();
  });

  it("restarts a declined request in the photo-first flow without copying private files", async () => {
    render(
      withIntl(
        <TrackView
          booking={booking({ status: "declined", canCancel: false })}
        />,
      ),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ramesh Kabadi Store couldn't take this booking",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You'll get about/)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Try another shop" }),
    );
    expect(push).toHaveBeenCalledWith("/sell");
    expect(JSON.parse(sessionStorage.getItem("lg.sellDraft") ?? "{}")).toEqual(
      expect.objectContaining({
        mode: "pickup",
        items: [],
        address: "",
        name: "",
      }),
    );
  });
});

describe("TrackNotFound", () => {
  it("explains and offers a way back to selling", () => {
    render(withIntl(<TrackNotFound />));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn't find this booking",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Book a collection" }),
    ).toHaveAttribute("href", "/sell");
  });
});
