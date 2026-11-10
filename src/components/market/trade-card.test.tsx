import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aTrade, WithIntl } from "./test-utils";
import { TradeCard } from "./trade-card";

const { act, toast, lifecycle } = vi.hoisted(() => ({
  act: vi.fn(),
  lifecycle: {
    legacy: false,
    state: "awaiting_payment",
    actions: [] as string[],
  },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => act,
  useQuery: () =>
    lifecycle.legacy
      ? null
      : {
          state: lifecycle.state,
          collection: "pending",
          settlement: "pending",
          refund: "none",
          actions: lifecycle.actions,
          policyReady: false,
          totalPaise: 175_000,
          grams: 100_000,
        },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("./sandbox-checkout", () => ({ SandboxCheckout: () => null }));
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

beforeEach(() => {
  act.mockReset();
  lifecycle.legacy = false;
  lifecycle.state = "awaiting_payment";
  lifecycle.actions = [];
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("TradeCard", () => {
  it("records seller-reported cash at the locked order amount after delivery", async () => {
    act.mockResolvedValue({ reference: "Cash 59", amountPaise: 175_000 });
    const user = userEvent.setup();
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({ status: "completed", directCashAvailable: true })}
          side="seller"
        />
      </WithIntl>,
    );
    await user.click(screen.getByText("Record cash received"));
    await user.type(screen.getByLabelText("Cash receipt reference"), "Cash 59");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(act).toHaveBeenCalledWith({
      tradeId: "trade1",
      reference: "Cash 59",
      amountPaise: 175_000,
    });
    expect(
      screen.queryByText("Waiting for gateway payment"),
    ).not.toBeInTheDocument();
  });

  it("keeps an accepted direct order cancellable without offering early cash", () => {
    lifecycle.actions = ["cancel"];
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({ status: "accepted", directCashAvailable: true })}
          side="seller"
        />
      </WithIntl>,
    );
    expect(
      screen.getByRole("button", { name: "Request cancellation" }),
    ).toBeVisible();
    expect(screen.queryByText("Record cash received")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Waiting for gateway payment"),
    ).not.toBeInTheDocument();
  });

  it("offers the recorded cash receipt to the buyer without a payment action", () => {
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({
            status: "completed",
            directCashReceipt: {
              reference: "Cash 59",
              amountPaise: 175_000,
              recordedAt: 1000,
            },
            paymentVerification: "reported_direct_cash",
          })}
          side="buyer"
        />
      </WithIntl>,
    );
    expect(screen.getByText("Cash reported received")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Receipt Cash 59" }),
    ).toHaveAttribute("href", "/app/trades/trade1/invoice");
    expect(screen.queryByText("Record cash received")).not.toBeInTheDocument();
  });

  it("keeps a late payment hold visible after an order was cancelled", () => {
    lifecycle.state = "hold";
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({
            status: "declined",
            timeline: [
              { status: "declined", at: Date.parse("2026-10-07T00:00:00Z") },
            ],
          })}
          side="buyer"
        />
      </WithIntl>,
    );
    expect(screen.getByText("Order needs review")).toBeVisible();
    expect(
      screen.getByText(
        "An administrator must check the payment evidence before this order can move forward.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/Order declined/)).not.toBeInTheDocument();
  });

  it("offers a new order to the seller as one tap", async () => {
    act.mockResolvedValue({ status: "accepted" });
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({ actions: ["accept", "decline"] })}
          side="seller"
        />
      </WithIntl>,
    );

    expect(
      screen.getByRole("heading", { name: "Newspaper · 100 kg" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "To Peenya Paper & Plastic Yard · Peenya Industrial Area",
      ),
    ).toBeInTheDocument();
    // The step it's waiting for is marked for screen readers too.
    const progress = screen.getByRole("list", { name: "Trade progress" });
    expect(progress.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Accepted: next",
    );

    await userEvent.click(screen.getByRole("button", { name: "Accept order" }));
    expect(act).toHaveBeenCalledWith({ tradeId: "trade1", action: "accept" });
    expect(toast.success).toHaveBeenCalledWith("Order accepted");
  });

  it("asks before declining, since it can't be undone", async () => {
    act.mockResolvedValue({ status: "declined" });
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({ actions: ["accept", "decline"] })}
          side="seller"
        />
      </WithIntl>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(act).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Decline this order from Peenya Paper & Plastic Yard?",
    );
    await userEvent.click(screen.getByRole("button", { name: "Yes, decline" }));
    expect(act).toHaveBeenCalledWith({ tradeId: "trade1", action: "decline" });
  });

  it("pauses accepted orders until a gateway is connected", () => {
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({
            status: "accepted",
            actions: ["pay"],
            counterparty: {
              name: "Ramesh Kabadi Store",
              area: "Yeshwanthpur",
              kind: "kabadiwala",
            },
          })}
          side="buyer"
        />
      </WithIntl>,
    );
    expect(
      screen.queryByRole("button", { name: /Pay/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Live payments require approved payment terms and provider setup.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("From Ramesh Kabadi Store · Yeshwanthpur"),
    ).toBeInTheDocument();
  });

  it("labels a prototype payment state unverified and blocks dispatch", () => {
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({
            grams: 2_000_000,
            paisePerKg: 3800,
            totalPaise: 7_600_000,
            status: "paid_to_escrow",
            inEscrow: true,
            needsEwayBill: true,
            legacyReceiptNo: "LG-26-0004",
            actions: ["dispatch"],
          })}
          side="seller"
        />
      </WithIntl>,
    );
    expect(
      screen.getByText(
        "Prototype record. Payment and delivery are unverified.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/held in escrow/)).not.toBeInTheDocument();
    expect(screen.getByText(/e-way bill must travel/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /dispatch/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Receipt LG-26-0004" }),
    ).toHaveAttribute("href", "/app/trades/trade1/invoice");
  });

  it("says what went wrong when an order decision fails", async () => {
    const { ConvexError } = await import("convex/values");
    act.mockRejectedValue(new ConvexError("NOT_ENOUGH_STOCK"));
    render(
      <WithIntl>
        <TradeCard
          trade={aTrade({
            status: "requested",
            actions: ["accept", "decline"],
          })}
          side="seller"
        />
      </WithIntl>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Accept order" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You don't have that much in stock.",
    );
    expect(toast.error).toHaveBeenCalled();
  });

  it("has nothing to press once it's done", () => {
    lifecycle.legacy = true;
    render(
      <WithIntl>
        <TradeCard trade={aTrade({ status: "completed" })} side="seller" />
      </WithIntl>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Prototype record. Payment and delivery are unverified.",
      ),
    ).toBeInTheDocument();
  });
});

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => true,
}));
