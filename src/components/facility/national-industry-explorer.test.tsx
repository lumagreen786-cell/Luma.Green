import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { beforeEach, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/components/shop/test-helpers";

import en from "../../../messages/en.json";
import { NationalIndustryExplorer } from "./national-industry-explorer";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

const activity = {
  code: "011101",
  title: "Growing of wheat",
  level: "subclass" as const,
  parentCode: "0111",
  sectionCode: "A",
  divisionCode: "01",
  groupCode: "011",
  classCode: "0111",
  source: { kind: "workbook", sheet: "All", row: 7, printedPage: null },
};

beforeEach(() => {
  vi.mocked(useQuery).mockReturnValue({
    sourceVersion: "NIC-2025",
    sourceQuality: "official_reference",
    sourceLanguage: "en",
    sourceWorkbookUrl: "https://www.mospi.gov.in/source.xlsx",
    sourcePublicationUrl: "https://www.mospi.gov.in/source.pdf",
    total: 1887,
    nextOffset: 25,
    items: [activity],
  });
});

it("keeps source language and provenance visible without permission claims", () => {
  renderWithIntl(<NationalIndustryExplorer />);
  expect(screen.getByText(en.industry.nationalNote)).toBeVisible();
  expect(screen.getByText(activity.title)).toHaveAttribute("lang", "en");
  expect(screen.getByText(activity.title)).toHaveAttribute("dir", "ltr");
  expect(
    screen.getByRole("link", { name: "MoSPI · NIC-2025" }),
  ).toHaveAttribute("href", "https://www.mospi.gov.in/source.pdf");
  expect(
    screen.queryByRole("button", { name: /011101/u }),
  ).not.toBeInTheDocument();
});

it("resets paging when the search changes and selects the exact activity", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  renderWithIntl(<NationalIndustryExplorer onSelect={onSelect} />);
  await user.click(screen.getByRole("button", { name: en.industry.next }));
  expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), {
    search: "",
    offset: 25,
  });
  await user.type(screen.getByRole("searchbox"), "wheat");
  expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), {
    search: "wheat",
    offset: 0,
  });
  await user.click(
    screen.getByRole("button", { name: `${en.industry.select}: 011101` }),
  );
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(activity);
});

it("shows loading and an empty result without selectable invented records", () => {
  vi.mocked(useQuery).mockReturnValue(undefined);
  const { unmount } = renderWithIntl(<NationalIndustryExplorer />);
  expect(screen.queryByText(activity.title)).not.toBeInTheDocument();
  unmount();
  vi.mocked(useQuery).mockReturnValue({
    sourceVersion: "NIC-2025",
    total: 0,
    nextOffset: null,
    items: [],
  });
  renderWithIntl(<NationalIndustryExplorer />);
  expect(screen.getByText(en.industry.empty)).toBeVisible();
  expect(screen.getByRole("button", { name: en.industry.next })).toBeDisabled();
});
