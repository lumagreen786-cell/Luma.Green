import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { priceProblem, RateRow } from "./rate-row";
import { NEWSPAPER, NOW, renderWithIntl } from "./test-helpers";
import type { RateCardRow } from "./types";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const setRate = vi.fn();
afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  setRate.mockReset();
  setRate.mockResolvedValue(null);
  vi.mocked(useMutation).mockReturnValue(
    setRate as unknown as ReturnType<typeof useMutation>,
  );
});

const NEWSPAPER_ROW: RateCardRow = {
  material: NEWSPAPER,
  myPaise: 1450,
  floorPaise: 1200,
  fallbackPaise: 1400,
  marketPaise: 1500,
  marketDate: "2026-09-29",
};

function renderRow(row: RateCardRow = NEWSPAPER_ROW) {
  renderWithIntl(
    <ul>
      <RateRow row={row} />
    </ul>,
  );
  return screen.getByRole("textbox", {
    name: "Your price for Newspaper, in rupees per kg",
  });
}

describe("priceProblem", () => {
  it("refuses invalid prices and permits independent offers", () => {
    expect(priceProblem("", 1200)).toBeNull();
    expect(priceProblem("abc", 1200)).toBe("invalid");
    expect(priceProblem("0", 1200)).toBe("invalid");
    expect(priceProblem("11.99", 1200)).toBeNull();
    expect(priceProblem("12", 1200)).toBeNull();
    expect(priceProblem("3", null)).toBeNull();
  });
});

describe("RateRow", () => {
  it("renews an unchanged offer after an open screen crosses its expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    renderRow({ ...NEWSPAPER_ROW, offerExpiresAt: NOW.getTime() + 1000 });
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await Promise.resolve();
    });
    expect(setRate).toHaveBeenCalledWith({
      materialCode: "PAPER-NEWS",
      paisePerKg: 1450,
    });
  });
  it("shows the price next to the minimum and today's market", () => {
    const input = renderRow();
    expect(input).toHaveValue("14.50");
    expect(screen.queryByText("Minimum ₹12/kg")).not.toBeInTheDocument();
    expect(screen.getByText(/Market ₹15\/kg/)).toBeInTheDocument();
    expect(screen.getByText("Below market")).toBeInTheDocument();
    // Nothing changed yet, so nothing to save.
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
  });

  it("saves an own offer below the old reference minimum", async () => {
    const user = userEvent.setup();
    const input = renderRow();
    await user.clear(input);
    await user.type(input, "11");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(setRate).toHaveBeenCalledWith({
      materialCode: "PAPER-NEWS",
      paisePerKg: 1100,
    });
  });

  it("saves a new price in paise", async () => {
    const user = userEvent.setup();
    const input = renderRow();

    await user.clear(input);
    await user.type(input, "15.5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(setRate).toHaveBeenCalledWith({
      materialCode: "PAPER-NEWS",
      paisePerKg: 1550,
    });
  });

  it("shows the floor when the server refuses the price", async () => {
    const user = userEvent.setup();
    setRate.mockRejectedValueOnce(new ConvexError("BELOW_FLOOR"));
    const input = renderRow({ ...NEWSPAPER_ROW, floorPaise: null });

    await user.clear(input);
    await user.type(input, "5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a valid price.",
      );
    });
  });

  it("keeps reference guidance separate from a missing own offer", () => {
    const input = renderRow({ ...NEWSPAPER_ROW, myPaise: null });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "14");
    expect(
      screen.queryByText("Not set yet. Households get the city price, ₹14/kg."),
    ).not.toBeInTheDocument();
  });
});

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => true,
}));
