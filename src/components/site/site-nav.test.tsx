import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { isCurrentSection, SiteNav } from "./site-nav";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname.current,
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

function renderNav() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SiteNav />
    </NextIntlClientProvider>,
  );
}

describe("SiteNav", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  it("uses a bounded panel for the horizontal navigation when links wrap", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toHaveClass("rounded-panel");
    expect(nav).not.toHaveClass("rounded-full");
  });

  it("is a named landmark with the four places people go", () => {
    renderNav();

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["/how-it-works", "/prices", "/help", "/join"]);
    expect(screen.getByRole("link", { name: "Prices" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Help" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Join" })).toBeVisible();
  });

  it("marks only the current page for assistive tech", () => {
    pathname.current = "/prices";
    renderNav();

    expect(screen.getByRole("link", { name: "Prices" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "How it works" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps a section current on the pages under it", () => {
    pathname.current = "/help/kabadiwala";
    renderNav();

    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("isCurrentSection", () => {
  it("matches the page and what's under it, not lookalike paths", () => {
    expect(isCurrentSection("/help", "/help")).toBe(true);
    expect(isCurrentSection("/help/yard", "/help")).toBe(true);
    expect(isCurrentSection("/helpful", "/help")).toBe(false);
    expect(isCurrentSection("/", "/help")).toBe(false);
  });
});
