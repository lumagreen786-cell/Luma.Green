import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";

import { renderWithIntl } from "@/components/shop/test-helpers";

import {
  getIndiaJurisdiction,
  INDIA_JURISDICTIONS,
} from "../../../convex/data/indiaJurisdictions";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { JurisdictionReference } from "./jurisdiction-reference";

it("starts without an inferred state or authority and lists all36 canonical names", async () => {
  const user = userEvent.setup();
  renderWithIntl(<JurisdictionReference />);
  const control = screen.getByRole("combobox", {
    name: en.industry.chooseJurisdiction,
  });
  expect(control).toHaveTextContent(en.industry.chooseJurisdiction);
  expect(control).toHaveAccessibleDescription(en.industry.jurisdictionNote);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await user.click(control);
  expect(screen.getAllByRole("option")).toHaveLength(36);
  for (const entry of INDIA_JURISDICTIONS) {
    expect(
      screen.getByRole("option", { name: entry.jurisdiction }),
    ).toBeVisible();
  }
  await user.keyboard("{Escape}");
  expect(control).toHaveFocus();
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});

it("selects an exact source record by keyboard and can clear it", async () => {
  const user = userEvent.setup();
  renderWithIntl(<JurisdictionReference />);
  const control = screen.getByRole("combobox", {
    name: en.industry.chooseJurisdiction,
  });
  await user.tab();
  expect(control).toHaveFocus();
  await user.keyboard("{Enter}");
  await user.keyboard("Karnataka");
  await user.keyboard("{Enter}");
  const entry = getIndiaJurisdiction("Karnataka");
  expect(control).toHaveTextContent("Karnataka");
  expect(
    screen.getByRole("link", { name: entry?.authorityName ?? "" }),
  ).toHaveAttribute("href", entry?.authorityUrl);
  expect(screen.getByRole("link", { name: en.industry.view })).toHaveAttribute(
    "href",
    entry?.sourceUrl,
  );
  expect(screen.getByText(entry?.sourceLocator ?? "")).toHaveAttribute(
    "lang",
    "en",
  );
  expect(screen.getByText("Apr 27, 2026")).toHaveAttribute(
    "dateTime",
    "2026-04-27",
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: en.industry.clear }));
  expect(control).toHaveTextContent(en.industry.chooseJurisdiction);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});

it("shows the unresolved J&K conflict with both attributed official sources", async () => {
  const user = userEvent.setup();
  renderWithIntl(<JurisdictionReference />);
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: "Jammu and Kashmir" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    en.industry.jurisdictionReview,
  );
  const entry = getIndiaJurisdiction("Jammu and Kashmir");
  const note = screen.getByText(entry?.reviewNote ?? "");
  expect(note).toHaveAttribute("lang", "en");
  expect(note).toHaveAttribute("dir", "ltr");
  const links = screen.getAllByRole("link");
  for (const link of links) {
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  expect(links.map((link) => link.getAttribute("href"))).toContain(
    entry?.supportingSources[0]?.url,
  );
  expect(screen.getByText(en.industry.jurisdictionNote)).toBeVisible();
});

it("keeps English source text left-to-right inside localized Arabic controls", async () => {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Kolkata">
      <JurisdictionReference />
    </NextIntlClientProvider>,
  );
  const control = screen.getByRole("combobox", {
    name: ar.industry.chooseJurisdiction,
  });
  expect(control).toHaveAttribute("dir", "rtl");
  await user.click(control);
  await user.click(
    screen.getByRole("option", {
      name: "Dadra and Nagar Haveli and Daman and Diu",
    }),
  );
  const entry = getIndiaJurisdiction(
    "Dadra and Nagar Haveli and Daman and Diu",
  );
  expect(screen.getByText(entry?.authorityName ?? "")).toHaveAttribute(
    "lang",
    "en",
  );
  expect(screen.getByText(entry?.authorityName ?? "")).toHaveAttribute(
    "dir",
    "ltr",
  );
  expect(screen.getByText(ar.industry.jurisdictionNote)).toBeVisible();
});
