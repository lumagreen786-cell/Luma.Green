import { fireEvent, render, screen, within } from "@testing-library/react";
import { useQuery } from "convex/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sampleBoard } from "@/components/prices/board.testing";

import messages from "../../../../messages/en.json";
import { PriceTeaser } from "./price-teaser";

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

function renderTeaser() {
  const result = render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
    >
      <PriceTeaser />
    </NextIntlClientProvider>,
  );
  const city = screen.queryByLabelText(messages.join.form.city);
  if (city) fireEvent.change(city, { target: { value: "Bengaluru" } });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  convex.configured = true;
  vi.mocked(useQuery).mockReturnValue(sampleBoard);
});

describe("PriceTeaser", () => {
  it("shows today's price for everyday scrap, never factory material", () => {
    renderTeaser();

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Newspaper"),
      expect.stringContaining("Cardboard boxes"),
      expect.stringContaining("PET bottles"),
      expect.stringContaining("Iron and steel"),
    ]);
    expect(within(rows[0]).getByText("₹14/kg")).toBeInTheDocument();
    expect(screen.queryByText(/Recycled PET flakes/)).not.toBeInTheDocument();
    expect(screen.getByText("Bengaluru · Sep 29")).toBeInTheDocument();
  });

  it("says the prices are samples and links to the full board", () => {
    renderTeaser();

    expect(
      screen.getByText("Sample prices for the prototype."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See all prices" }),
    ).toHaveAttribute("href", "/prices");
  });

  it("holds its shape while loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    renderTeaser();

    expect(screen.getByRole("status", { name: "Loading…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "Today's prices" }),
    ).toBeInTheDocument();
  });

  it("still points to the board when Convex isn't connected", () => {
    convex.configured = false;
    renderTeaser();

    expect(
      screen.getByText("Today's prices will show here soon."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all prices" })).toBeVisible();
    expect(
      screen.getByRole("status", { name: messages.home.teaser.unavailable }),
    ).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText(messages.common.loading)).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(useQuery).not.toHaveBeenCalled();
  });

  it("keeps the empty price layout without suggesting that a fetch is still pending", () => {
    vi.mocked(useQuery).mockReturnValue({
      ...sampleBoard,
      rows: [],
      date: null,
    });
    renderTeaser();

    expect(
      screen.getByRole("status", { name: messages.home.teaser.unavailable }),
    ).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See all prices" }),
    ).toHaveAttribute("href", "/prices");
  });
});
