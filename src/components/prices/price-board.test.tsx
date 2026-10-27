import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { sampleBoard } from "./board.testing";
import { PriceBoard } from "./price-board";

const convex = vi.hoisted(() => ({ configured: true }));

vi.mock("@/components/providers/convex-provider", () => ({
  get isConvexConfigured() {
    return convex.configured;
  },
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn(),
}));

function renderBoard() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
    >
      <PriceBoard />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  convex.configured = true;
  vi.mocked(useQuery).mockReturnValue(sampleBoard);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PriceBoard", () => {
  it("groups household scrap by family, with recycled material apart", () => {
    renderBoard();

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Paper", "Plastic", "Metal", "Factory gate"]);
    const paper = screen.getByRole("region", { name: "Paper" });
    expect(
      within(paper)
        .getAllByRole("button")
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining("Newspaper"),
      expect.stringContaining("Cardboard boxes"),
    ]);
    const factoryGate = screen.getByRole("region", { name: "Factory gate" });
    expect(
      within(factoryGate).getByRole("button", { name: /Recycled PET flakes/ }),
    ).toBeInTheDocument();
  });

  it("reads each row out with its price and week change without a mandatory floor", () => {
    renderBoard();

    const newspaper = screen.getByRole("button", { name: /Newspaper/ });
    expect(newspaper).toHaveTextContent("₹14/kg");
    expect(newspaper).toHaveTextContent("Up 2.1% this week");
    expect(newspaper).not.toHaveTextContent("Floor");
    expect(screen.getByRole("button", { name: /Cardboard/ })).toHaveTextContent(
      "Down 1.3% this week",
    );
    expect(
      screen.getByRole("button", { name: /PET bottles/ }),
    ).toHaveTextContent("No change this week");
  });

  it("says once that the prices are sample data, and for which day", () => {
    renderBoard();

    expect(
      screen.getByText(
        "Sample prices for the prototype, not live market rates.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Prices for/)).toHaveTextContent("Sep 29");
  });

  it("opens a 30-day chart for a material, and closes it again", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(screen.getByRole("button", { name: /Iron and steel/ }));

    const dialog = await screen.findByRole("dialog", {
      name: "Iron and steel",
    });
    expect(dialog).toHaveTextContent("METAL-IRON · Metal · Bengaluru");
    expect(within(dialog).getByText("30-day low")).toBeInTheDocument();
    const chart = within(dialog).getByRole("slider", {
      name: /Iron and steel: price per kilo/,
    });
    expect(chart).toHaveAttribute("aria-valuetext", "Sep 29: ₹28");
    expect(
      within(dialog).getByRole("table", {
        name: "Iron and steel, price per kilo by day",
      }),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets the keyboard walk the chart day by day", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(screen.getByRole("button", { name: /Newspaper/ }));
    const chart = await screen.findByRole("slider");

    chart.focus();
    await user.keyboard("{ArrowLeft}");
    expect(chart).toHaveAttribute("aria-valuetext", "Sep 28: ₹14.50");
    await user.keyboard("{Home}");
    expect(chart).toHaveAttribute("aria-valuetext", "Aug 31: ₹14.50");
    await user.keyboard("{End}");
    expect(chart).toHaveAttribute("aria-valuetext", "Sep 29: ₹14");
  });

  it("shows a skeleton while prices load", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    renderBoard();

    expect(screen.getByRole("status", { name: "Loading…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when there are no prices yet", () => {
    vi.mocked(useQuery).mockReturnValue({
      ...sampleBoard,
      rows: [],
      date: null,
    });
    renderBoard();

    expect(screen.getByText("No prices yet")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "No prices yet" }),
    ).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });

  it("explains itself kindly when Convex isn't connected", () => {
    convex.configured = false;
    renderBoard();

    expect(
      screen.getByText("Prices aren't available right now"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: messages.prices.unavailable.title }),
    ).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText(messages.common.loading)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(useQuery).not.toHaveBeenCalled();
  });

  it("keeps placeholders when materials exist without market quotes", () => {
    vi.mocked(useQuery).mockReturnValue({
      ...sampleBoard,
      date: null,
      rows: sampleBoard.rows.map((row) => ({
        ...row,
        todayPaise: null,
        weekChangePct: null,
        series: [],
      })),
    });
    renderBoard();

    expect(screen.getByRole("status", { name: "No prices yet" })).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });

  it("offers a retry when the live query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => null);
    vi.mocked(useQuery).mockImplementation(() => {
      throw new Error("offline");
    });
    const user = userEvent.setup();
    renderBoard();

    expect(screen.getByText("Prices couldn't load")).toBeInTheDocument();
    vi.mocked(useQuery).mockReturnValue(sampleBoard);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("region", { name: "Paper" })).toBeInTheDocument();
  });
});
