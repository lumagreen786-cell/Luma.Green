import { render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import arabic from "../../../../messages/ar.json";
import english from "../../../../messages/en.json";
import kannada from "../../../../messages/kn.json";
import urdu from "../../../../messages/ur.json";
import { PriceTeaser } from "./price-teaser";

const convex = vi.hoisted(() => ({ configured: true }));
vi.mock("@/components/providers/convex-provider", () => ({
  get isConvexConfigured() {
    return convex.configured;
  },
}));
vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
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
beforeEach(() => {
  vi.clearAllMocks();
});

it.each([
  ["en", english],
  ["kn", kannada],
  ["ar", arabic],
  ["ur", urdu],
] as const)(
  "keeps configured home action-only and sends %s users to explicit locality selection",
  (locale, messages) => {
    convex.configured = true;
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <PriceTeaser />
      </NextIntlClientProvider>,
    );
    expect(
      container.querySelector(
        'form,input,textarea,select,[contenteditable="true"]',
      ),
    ).toBeNull();
    expect(useQuery).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: messages.home.teaser.title }),
    ).toBeVisible();
    expect(screen.getByText(messages.prices.lead)).toBeVisible();
    expect(
      screen.getByRole("link", { name: messages.home.teaser.seeAll }),
    ).toHaveAttribute("href", "/prices");
    expect(container).not.toHaveTextContent("Bengaluru");
  },
);

it("keeps the city-selection link usable without configured data", () => {
  convex.configured = false;
  render(
    <NextIntlClientProvider locale="en" messages={english}>
      <PriceTeaser />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByRole("link", { name: english.home.teaser.seeAll }),
  ).toHaveAttribute("href", "/prices");
  expect(useQuery).not.toHaveBeenCalled();
});
