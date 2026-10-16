import { render, screen } from "@testing-library/react";
import { type FunctionReference, getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";

import { ConsoleHome } from "./console-home";

const queries = vi.hoisted(() => ({
  people: vi.fn(),
  queue: vi.fn<() => unknown[]>(),
}));
vi.mock("convex/react", () => ({
  useQuery: (query: FunctionReference<"query">): unknown => {
    switch (getFunctionName(query)) {
      case "identity:me": {
        return { adminName: "Test admin" };
      }
      case "admin:overview": {
        return { recentSignIns: queries.people() };
      }
      case "review:queue": {
        return queries.queue();
      }
      case "review:summary": {
        return { waiting: 0, overdue: 0, dueSoon: 0, openSupport: 0 };
      }
      default: {
        throw new Error("Unexpected query");
      }
    }
  },
}));

beforeEach(() => {
  queries.people.mockReturnValue([]);
  queries.queue.mockReturnValue([]);
});

it("describes new profiles without claiming phone verification or sign-in activity", () => {
  queries.people.mockReturnValue([
    { id: "fictional-profile", locale: "en", createdAt: Date.UTC(2026, 9, 6) },
  ]);
  render(<ConsoleHome />);
  expect(
    screen.getByRole("heading", { name: "Recent accounts" }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "View pilot report" }),
  ).toHaveAttribute("href", "/admin/pilot");
  expect(
    screen.getByRole("columnheader", { name: "Profile created" }),
  ).toBeVisible();
  expect(
    screen.queryByText(/confirmed their phone|Latest sign-ins|First signed in/),
  ).not.toBeInTheDocument();
});

it("explains an empty account list without requiring a phone identity", () => {
  render(<ConsoleHome />);
  expect(screen.getByText("No account profiles yet.")).toBeVisible();
  expect(
    screen.getByText(
      "New accounts appear here after their profile is created.",
    ),
  ).toBeVisible();
});

it("puts the next submitted applications before supporting account data", () => {
  queries.queue.mockReturnValue([
    { id: "returned", name: "Returned demo", status: "changes_requested" },
    ...[1, 2, 3, 4].map((number) => ({
      id: `demo-${String(number)}`,
      name: `Demo ${String(number)}`,
      area: "Demo area",
      status: "submitted",
    })),
  ]);
  render(<ConsoleHome />);
  expect(screen.getByRole("heading", { name: "Work queue" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Review applications" }),
  ).toHaveAttribute("href", "/admin/verification");
  expect(
    screen.getByRole("link", { name: "Demo 1 Demo area" }),
  ).toHaveAttribute("href", "/admin/verification/demo-1");
  expect(screen.queryByText("Returned demo")).not.toBeInTheDocument();
  expect(screen.queryByText("Demo 4")).not.toBeInTheDocument();
});
