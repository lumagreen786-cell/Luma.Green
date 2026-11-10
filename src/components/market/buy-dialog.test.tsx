import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BuyButton } from "./buy-dialog";
import { aListing, WithIntl } from "./test-utils";

const { requestTrade, toast } = vi.hoisted(() => ({
  requestTrade: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => requestTrade,
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  requestTrade.mockReset();
  toast.success.mockReset();
});

async function openDialog(listing = aListing(), locale = "en") {
  render(
    <WithIntl locale={locale}>
      <BuyButton listing={listing} />
    </WithIntl>,
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: "Buy Newspaper from Ramesh Kabadi Store",
    }),
  );
  return screen.getByRole("dialog", { name: "Buy Newspaper" });
}

describe("BuyButton", () => {
  it("shows the total as the weight is typed", async () => {
    await openDialog();
    expect(
      screen.getByText(
        "Business payments use the payment gateway. Check the order for its current payment status.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/escrow/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("How many kg?"), "100");
    expect(screen.getByText("₹1,750")).toBeInTheDocument();
    expect(screen.getByText("100 kg × ₹17.50/kg")).toBeInTheDocument();
  });

  it("does not present payment instructions before a direct order is delivered", async () => {
    await openDialog(aListing({ directCashAvailable: true }));
    expect(
      screen.queryByText(/The buyer pays the seller directly/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/use the payment gateway/),
    ).not.toBeInTheDocument();
  });

  it("won't ask for more than the lot holds", async () => {
    await openDialog();
    await userEvent.type(screen.getByLabelText("How many kg?"), "200");
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only 150 kg is available.",
    );
    expect(requestTrade).not.toHaveBeenCalled();
  });

  it("asks for the whole lot in grams, then confirms", async () => {
    requestTrade.mockResolvedValue("trade1");
    await openDialog();
    await userEvent.click(screen.getByRole("button", { name: "All 150 kg" }));
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(requestTrade).toHaveBeenCalledWith({
      listingId: "listing1",
      grams: 150_000,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Request sent to Ramesh Kabadi Store",
      expect.objectContaining({
        action: expect.objectContaining({ label: "See trades" }),
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it.each([
  ["en", "2"],
  ["ar", "٢"],
  ["fr", "2,5"],
])(
  "keeps an unsafe %s total editable and does not send a trade",
  async (locale, input) => {
    await openDialog(
      aListing({ askPaisePerKg: Number.MAX_SAFE_INTEGER }),
      locale,
    );
    await userEvent.type(screen.getByLabelText("How many kg?"), input);
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/price/i);
    expect(requestTrade).not.toHaveBeenCalled();
    expect(screen.getByLabelText("How many kg?")).toHaveValue(input);
  },
);

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => true,
}));
