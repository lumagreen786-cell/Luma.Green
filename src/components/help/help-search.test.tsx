import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { HelpSearch } from "./help-search";

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

function renderSearch() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HelpSearch />
    </NextIntlClientProvider>,
  );
}

describe("HelpSearch", () => {
  it("shows no results until someone searches", () => {
    renderSearch();
    expect(
      screen.getByRole("searchbox", { name: "Search help" }),
    ).toBeVisible();
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      "Search help",
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    // …but every topic is one tap away.
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(12);
  });

  it("finds guides and questions as you type, each with a link", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole("searchbox"), "sms code");

    const results = screen.getByRole("region", {
      name: /answers for “sms code”/,
    });
    expect(
      within(results).getByRole("link", { name: "Sign in with an SMS code" }),
    ).toHaveAttribute("href", "/help/kabadiwala/sign-in");
    expect(
      within(results).getByRole("link", { name: "I didn't get the SMS code" }),
    ).toHaveAttribute("href", "/help/household#faq-no-code");
    expect(
      within(results).getAllByText(
        /For Kabadiwalas, Preprocessors, Recyclers/,
      )[0],
    ).toBeInTheDocument();
  });

  it("filters by topic with one tap, and un-filters with another", async () => {
    const user = userEvent.setup();
    renderSearch();
    const privacy = screen.getByRole("button", { name: "Privacy" });

    await user.click(privacy);
    expect(privacy).toHaveAttribute("aria-pressed", "true");
    const results = screen.getByRole("region", { name: /about Privacy/ });
    expect(
      within(results).getByRole("link", { name: "What happens to my photos?" }),
    ).toBeInTheDocument();

    await user.click(privacy);
    expect(privacy).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("offers to ask a person when nothing matches", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole("searchbox"), "helicopter");

    expect(
      screen.getByText(messages.help.search.emptyTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.help.search.ask }),
    ).toHaveAttribute("href", "/help/contact");
  });

  it("clears the search with one button", async () => {
    const user = userEvent.setup();
    renderSearch();
    const box = screen.getByRole("searchbox");
    await user.type(box, "escrow");
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(box).toHaveValue("");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("shows the first few results, then all of them on request", async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(screen.getByRole("searchbox"), "the");

    const results = screen.getByRole("region");
    expect(within(results).getAllByRole("link")).toHaveLength(8);
    const more = within(results).getByRole("button", { name: /Show all/ });
    await user.click(more);
    expect(within(results).getAllByRole("link").length).toBeGreaterThan(8);
  });
});
