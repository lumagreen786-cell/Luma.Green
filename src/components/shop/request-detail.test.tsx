import { screen } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestDetail } from "./request-detail";
import {
  booking,
  fakeQueries,
  NEWSPAPER,
  NOW,
  PET,
  renderWithIntl,
  SHOP_WORKSPACE,
} from "./test-helpers";
import type { BookingDetail, BookingView, RateCard } from "./types";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: { id: "fixture-user" },
        session: { id: "fixture-session", userId: "fixture-user" },
      },
      isPending: false,
      error: null,
    }),
  },
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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
}));

const RATES: BookingDetail["rates"] = [
  { materialCode: "PAPER-NEWS", paisePerKg: 1450, source: "mine" },
  { materialCode: "PLASTIC-PET", paisePerKg: 2100, source: "mine" },
];

const RATE_CARD: RateCard = {
  city: "Bengaluru",
  rows: [
    {
      material: NEWSPAPER,
      myPaise: 1450,
      floorPaise: 1200,
      fallbackPaise: 1400,
      marketPaise: 1500,
      marketDate: "2026-09-29",
    },
    {
      material: PET,
      myPaise: 2100,
      floorPaise: 1600,
      fallbackPaise: 2000,
      marketPaise: 2000,
      marketDate: "2026-09-29",
    },
  ],
};

function detail(
  view: BookingView,
  extra: Partial<BookingDetail> = {},
): BookingDetail {
  const hour = 3_600_000;
  return {
    booking: view,
    timeline: [{ status: "requested", at: NOW.getTime() - 2 * hour }],
    rates: RATES,
    points: null,
    ...extra,
  };
}

function renderDetail(result: BookingDetail | null | undefined) {
  vi.mocked(useQuery).mockImplementation(
    fakeQueries({
      "workspace:mine": SHOP_WORKSPACE,
      "shop:get": result,
      "householdPhotos:list": [],
      "shop:rateCard": RATE_CARD,
    }) as unknown as typeof useQuery,
  );
  renderWithIntl(<RequestDetail id="booking-1" />);
}

beforeEach(() => {
  vi.mocked(useMutation).mockReturnValue(
    vi.fn() as unknown as ReturnType<typeof useMutation>,
  );
});

describe("RequestDetail", () => {
  it("keeps the household private until the shop accepts", () => {
    renderDetail(detail(booking()));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Priya",
    );
    expect(screen.getByText("Yeshwanthpur")).toBeInTheDocument();
    expect(screen.getByText("+91•••••••109")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You'll see the full address and phone number once you accept.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Call" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByText("₹14.50/kg")).toBeInTheDocument();
    expect(screen.getByText("About ₹228")).toBeInTheDocument();
    // Nothing to weigh before accepting.
    expect(
      screen.queryByRole("heading", { name: "Weigh and pay" }),
    ).not.toBeInTheDocument();
  });

  it("gives an accepted pickup a call button, directions, the trip and the scale", () => {
    const accepted = booking({
      name: "Meena Iyer",
      phone: "+919845000012",
      address: "5, Sampige Road, Malleshwaram, Bengaluru",
      status: "accepted",
    });
    renderDetail(detail(accepted));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Meena Iyer",
    );
    expect(screen.getByText("+91 98450 00012")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute(
      "href",
      "tel:+919845000012",
    );
    expect(screen.getByRole("link", { name: "Directions" })).toHaveAttribute(
      "href",
      expect.stringContaining("Malleshwaram") as string,
    );
    expect(
      screen.getByRole("button", { name: "Start trip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Weigh and pay" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Newspaper, in kg" }),
    ).toHaveValue("12");
  });

  it("shows the receipt and the points once paid", () => {
    const paidAt = NOW.getTime() - 3_600_000;
    const paid = booking({
      name: "Vikram Shetty",
      phone: "+919845000015",
      address: "Nandini Layout, Bengaluru",
      status: "completed",
      receipt: {
        lines: [
          {
            material: NEWSPAPER,
            grams: 19_250,
            paisePerKg: 1450,
            paise: 27_913,
          },
          { material: PET, grams: 2500, paisePerKg: 2100, paise: 5250 },
        ],
        totalPaise: 33_163,
        method: "upi",
        paidAt,
      },
    });
    renderDetail(
      detail(paid, {
        points: 33,
        timeline: [
          { status: "requested", at: paidAt - 7_200_000 },
          { status: "accepted", at: paidAt - 3_600_000 },
          { status: "completed", at: paidAt },
        ],
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Paid ₹331.63" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Thank you for recycling, Vikram!"),
    ).toBeInTheDocument();
    expect(screen.getByText("Vikram earned 33 points")).toBeInTheDocument();
    expect(screen.getByText("19.25 kg at ₹14.50/kg")).toBeInTheDocument();
    expect(screen.getByText("Weighed and paid")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Confirm/ }),
    ).not.toBeInTheDocument();
  });

  it("says when a request isn't this shop's, or doesn't exist", () => {
    renderDetail(null);
    expect(screen.getByText("Request not found")).toBeInTheDocument();
  });
});

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => true,
}));
