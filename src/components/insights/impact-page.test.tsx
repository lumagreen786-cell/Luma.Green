import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { ImpactPage } from "./impact-page";
import type { OrgImpact, SaathiImpact } from "./types";

const impact = vi.hoisted((): { current: unknown } => ({ current: undefined }));
const workspace = vi.hoisted((): { current: unknown } => ({
  current: undefined,
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => {
    if (impact.current instanceof Error) throw impact.current;
    return impact.current;
  },
}));
vi.mock("@/components/app/use-workspace", () => ({
  useWorkspace: () => workspace.current,
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

/** Ramesh Kabadi Store in the demo world. */
const shop: OrgImpact = {
  kind: "org",
  orgKind: "kabadiwala",
  households: { grams: 81_480, paise: 158_741, count: 3 },
  bought: { grams: 0, paise: 0, count: 0 },
  sold: { grams: 400_000, paise: 700_000, count: 1 },
  recycledGrams: 433_950,
  co2eKg: 448.5,
  families: [
    { family: "paper", grams: 400_000, co2eKg: 400 },
    { family: "metal", grams: 29_100, co2eKg: 43.65 },
    { family: "plastic", grams: 4850, co2eKg: 4.85 },
  ],
  since: Date.parse("2026-09-20T10:00:00+05:30"),
};

const lakshmi: SaathiImpact = {
  kind: "saathi",
  totalPaise: 110_000,
  jobsDone: 2,
  weekPaise: 110_000,
  weekJobs: 2,
  byKind: [
    { kind: "yard_sorting", jobs: 1, paise: 70_000 },
    { kind: "home_pickups", jobs: 1, paise: 40_000 },
  ],
  recent: [
    {
      id: "job-1" as Id<"jobs">,
      kind: "yard_sorting",
      title: "Sorting shift: cartons",
      area: "Peenya",
      date: "2026-09-27",
      window: "morning",
      payPaise: 70_000,
      status: "done",
      postedBy: { name: "Peenya Paper & Plastic Yard", kind: "yard" },
      inMyArea: false,
    },
  ],
};

function renderPage() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
    >
      <ImpactPage />
    </NextIntlClientProvider>,
  );
}

/** A KPI card's value, found by its label. */
function kpi(label: string) {
  return screen.getByText(label).closest("div")?.parentElement;
}

beforeEach(() => {
  workspace.current = { kind: "org", org: { kind: "kabadiwala" } };
  impact.current = shop;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImpactPage for a business", () => {
  it("shows unknown factors as unavailable without hiding measured kilograms", () => {
    impact.current = {
      ...shop,
      co2eKg: null,
      families: [{ family: "paper", grams: 400_000, co2eKg: null }],
    };
    renderPage();
    expect(kpi("CO₂e avoided")).toHaveTextContent("—");
    expect(kpi("CO₂e avoided")).toHaveTextContent(
      messages.impact.factorUnavailable,
    );
    expect(kpi("CO₂e avoided")).not.toHaveTextContent("0 kg");
    expect(kpi("Kilos recycled")).toHaveTextContent("434 kg");
    expect(
      within(screen.getByRole("list", { name: "By material" })).getByText(
        messages.impact.factorUnavailable,
      ),
    ).toBeVisible();
  });
  it("leads with kilos, CO2e and the money that moved", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Your impact" }),
    ).toBeInTheDocument();
    expect(kpi("Kilos recycled")).toHaveTextContent("434 kg");
    expect(kpi("CO₂e avoided")).toHaveTextContent("449 kg");
    expect(kpi("Paid to households")).toHaveTextContent("₹1,587.41");
    expect(kpi("Paid to households")).toHaveTextContent("3 pickups");
    expect(kpi("Earned from sales")).toHaveTextContent("₹7,000");
    expect(kpi("Earned from sales")).toHaveTextContent("1 sale");
  });

  it("breaks the kilos down by material, every value written out", () => {
    renderPage();
    const chart = screen.getByRole("list", { name: "By material" });
    const rows = within(chart).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Paper400 kg400 kg CO₂e avoided",
      "Metal29.1 kg43.7 kg CO₂e avoided",
      "Plastic4.9 kg4.9 kg CO₂e avoided",
    ]);
  });

  it("shows ledger details on request while keeping the sample notice visible", async () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "A credit-ready ledger" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Who")).not.toBeVisible();
    await userEvent.click(screen.getByText("A credit-ready ledger"));
    expect(screen.getByText("Who")).toBeVisible();
    expect(screen.getByText(/^Sample data/)).toBeInTheDocument();
  });

  it("shows a factory what recycled material it bought", () => {
    impact.current = {
      ...shop,
      orgKind: "manufacturer",
      households: { grams: 0, paise: 0, count: 0 },
      bought: { grams: 2_500_000, paise: 17_500_000, count: 1 },
      sold: { grams: 0, paise: 0, count: 0 },
    };
    renderPage();
    expect(kpi("Recycled material bought")).toHaveTextContent("1 purchase");
    expect(kpi("Spent on material")).toHaveTextContent("₹1,75,000");
    expect(screen.queryByText("Earned from sales")).not.toBeInTheDocument();
  });

  it("starts empty until the first pickup or trade completes", () => {
    impact.current = {
      ...shop,
      households: { grams: 0, paise: 0, count: 0 },
      sold: { grams: 0, paise: 0, count: 0 },
      recycledGrams: 0,
      co2eKg: 0,
      families: [],
      since: null,
    };
    renderPage();
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
  });

  it("offers a retry when the numbers can't be loaded", async () => {
    vi.spyOn(console, "error").mockImplementation(vi.fn());
    impact.current = new Error("offline");
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");

    impact.current = shop;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Kilos recycled")).toBeInTheDocument();
  });
});

describe("ImpactPage for a Saathi", () => {
  beforeEach(() => {
    workspace.current = { kind: "saathi", saathi: { name: "Lakshmi Devi" } };
    impact.current = lakshmi;
  });

  it("shows earnings, by kind of work and job by job", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Your earnings" }),
    ).toBeInTheDocument();
    expect(kpi("Earned so far")).toHaveTextContent("₹1,100");
    expect(kpi("Earned so far")).toHaveTextContent("2 jobs done");
    expect(
      screen.getByRole("list", { name: "By kind of work" }),
    ).toHaveTextContent("Sorting at a yard₹7001 job");
    expect(
      screen.getByText("For Peenya Paper & Plastic Yard"),
    ).toBeInTheDocument();
  });

  it("points a new Saathi to their first job", () => {
    impact.current = {
      ...lakshmi,
      totalPaise: 0,
      jobsDone: 0,
      weekPaise: 0,
      weekJobs: 0,
      byKind: [],
      recent: [],
    };
    renderPage();
    expect(screen.getByText("No finished jobs yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find a job" })).toHaveAttribute(
      "href",
      "/app",
    );
  });
});
