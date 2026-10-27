import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { EMPTY_DRAFT, type SellDraft } from "./draft";
import { WhenStep } from "./when-step";

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

const TODAY = "2026-09-29";
/** 5 pm in Bengaluru: morning and afternoon are over for today. */
const FIVE_PM = Date.UTC(2026, 8, 29, 16, 30) - 5.5 * 60 * 60 * 1000;

function renderWhen(
  draft: Partial<SellDraft>,
  problems: ("day" | "window" | "address" | "name")[] = [],
) {
  const onChange = vi.fn();
  render(
    withIntl(
      <WhenStep
        draft={{ ...EMPTY_DRAFT, items: [], ...draft }}
        shop={undefined}
        today={TODAY}
        now={FIVE_PM}
        problems={problems}
        onChange={onChange}
      />,
    ),
  );
  return onChange;
}

describe("WhenStep", () => {
  it("offers the next seven days, today first", () => {
    renderWhen({});
    const days = screen.getAllByRole("radio", { name: /Today|Tomorrow|\d/ });
    expect(days.length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
  });

  it("drops today once every time has passed, and stays inside the seven-date horizon", () => {
    const onChange = vi.fn();
    render(
      withIntl(
        <WhenStep
          draft={EMPTY_DRAFT}
          shop={undefined}
          today={TODAY}
          now={FIVE_PM + 2.5 * 60 * 60 * 1000}
          problems={[]}
          onChange={onChange}
        />,
      ),
    );
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    const days = screen
      .getAllByRole("radio")
      .filter((radio) => radio.id.startsWith("day-"));
    expect(days.map((radio) => radio.id)).toEqual([
      "day-2026-09-30",
      "day-2026-10-01",
      "day-2026-10-02",
      "day-2026-10-03",
      "day-2026-10-04",
      "day-2026-10-05",
    ]);
  });

  it("closes today's windows that have passed", () => {
    renderWhen({ slotDate: TODAY });
    expect(screen.getByRole("radio", { name: /Morning/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Afternoon/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Evening/ })).toBeEnabled();
  });

  it("keeps a time that's still open when the day changes", async () => {
    const onChange = renderWhen({ slotDate: TODAY, slotWindow: "evening" });
    await userEvent.click(screen.getByText("Tomorrow"));
    expect(onChange).toHaveBeenCalledWith({
      slotDate: "2026-09-30",
      slotWindow: "evening",
    });
  });

  it("asks for an address for a pickup, never for a drop-off", () => {
    renderWhen({ mode: "pickup" });
    expect(
      screen.getByRole("textbox", { name: "Pickup address" }),
    ).toBeInTheDocument();
  });

  it("points at what's missing once they've tried to go on", () => {
    renderWhen({ mode: "pickup" }, ["day", "address", "name"]);
    const alerts = screen
      .getAllByRole("alert")
      .map((alert) => alert.textContent);
    expect(alerts).toEqual([
      messages.sell.when.errors.day,
      messages.sell.when.errors.address,
      messages.sell.when.errors.name,
    ]);
    expect(screen.getByRole("textbox", { name: "Your name" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
