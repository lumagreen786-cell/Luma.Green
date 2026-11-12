import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { locales } from "@/i18n/locales";

import messages from "../../../../messages/en.json";
import { ClosingCta } from "../closing-cta";
import { BusinessTrade } from "./business-trade";
import { ChainDiagram } from "./chain-diagram";
import { HomeHero } from "./hero";
import { RoleBenefits } from "./role-benefits";
import { TrustPoints } from "./trust-points";
import { WhyNow } from "./why-now";

vi.mock("next-intl/server", () => import("../intl-server.testing"));

vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: false,
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

async function renderSection(section: Promise<ReactNode>) {
  const element = await section;
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("home page", () => {
  it("leads with the promise and three ways in", async () => {
    await renderSection(HomeHero());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.home.hero.title,
    );
    expect(
      screen.getByRole("link", { name: messages.home.hero.sell }),
    ).toHaveAttribute("href", "/sell");
    expect(
      screen.getByRole("link", { name: messages.home.hero.join }),
    ).toHaveAttribute("href", "/join");
    expect(
      screen.getByRole("link", { name: "Prices: View material prices" }),
    ).toHaveAttribute("href", "/prices");
    expect(
      screen
        .getByRole("region", { name: messages.home.hero.title })
        .querySelector("img[data-recycling-illustration]"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      screen
        .getByRole("region", { name: messages.home.hero.title })
        .querySelector("img[data-recycling-illustration]"),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("recycle-household-illustration.webp"),
    );
    // Home directs people to explicit locality selection without assuming a city.
    expect(screen.getByText(messages.prices.lead)).toBeInTheDocument();
  });

  it("draws the chain in the order scrap moves, numbered", async () => {
    await renderSection(ChainDiagram());

    const chain = screen.getByRole("region", { name: "How materials move" });
    const steps = within(chain).getAllByRole("listitem");
    expect(
      steps.map((step) => within(step).getByRole("heading").textContent),
    ).toEqual([
      "Households",
      "Kabadiwalas",
      "Preprocessors",
      "Recyclers",
      "Manufacturers",
    ]);
    expect(steps.at(-1)).toHaveTextContent("5");
    expect(
      within(chain).getByText(/Saathis help all along the chain/),
    ).toBeInTheDocument();
    expect(
      within(chain).getByText(/Business payments use the payment gateway\./),
    ).toBeInTheDocument();
  });

  it("opens each role detail and its correct entry action", async () => {
    await renderSection(RoleBenefits());
    const tabs = screen.getAllByRole("tab");
    const destinations = [
      "/sell",
      "/join/kabadiwala",
      "/join/yard",
      "/join/recycler",
      "/join/manufacturer",
      "/join/saathi",
    ];
    expect(tabs).toHaveLength(destinations.length);
    for (const [index, tab] of tabs.entries()) {
      fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
      expect(tab).toHaveAttribute("aria-selected", "true");
      expect(
        within(screen.getByRole("tabpanel")).getByRole("link"),
      ).toHaveAttribute("href", destinations[index]);
    }
  });

  it("offers five business choices without repeating household booking", async () => {
    await renderSection(RoleBenefits({ businessOnly: true }));
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/join/kabadiwala",
    );
    expect(
      screen.getByRole("link", {
        name: `${messages.join.start}: ${messages.home.roles.kabadiwala.cta}`,
      }),
    ).toHaveTextContent(messages.join.start);
    expect(
      screen.queryByRole("tab", { name: "Households" }),
    ).not.toBeInTheDocument();
  });

  it("keeps trade boundaries visible beside the manufacturer path", async () => {
    await renderSection(BusinessTrade());
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(messages.howItWorks.trade.body)).toBeVisible();
    const action = screen.getByRole("link", {
      name: `${messages.join.start}: ${messages.home.roles.manufacturer.cta}`,
    });
    expect(action).toHaveTextContent(messages.join.start);
    expect(action).toHaveAttribute("href", "/join/manufacturer");
  });

  it("counts the languages from the locale registry", async () => {
    await renderSection(TrustPoints());

    expect(
      screen.getByRole("heading", {
        name: `${String(locales.length)} languages`,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
  });

  it("explains why now without inventing numbers", async () => {
    await renderSection(WhyNow());

    const reasons = screen.getAllByRole("listitem");
    expect(reasons).toHaveLength(3);
    for (const reason of reasons) expect(reason).not.toHaveTextContent(/\d/);
  });

  it("closes with the same two ways in", async () => {
    await renderSection(ClosingCta());

    expect(
      screen.getByRole("link", { name: messages.home.hero.sell }),
    ).toHaveAttribute("href", "/sell");
    expect(
      screen.getByRole("link", { name: "Join: Join as a business" }),
    ).toHaveAttribute("href", "/join");
  });
});
