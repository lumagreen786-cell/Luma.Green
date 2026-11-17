import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { SitePageSwitcher } from "./site-page-switcher";

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

it("uses a transparent grid control and opens the labelled navigation", async () => {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SitePageSwitcher />
    </NextIntlClientProvider>,
  );
  const trigger = screen.getByRole("button", { name: messages.nav.label });
  expect(trigger).toHaveClass("size-11", "rounded-xl", "bg-transparent");
  expect(trigger).not.toHaveClass("bg-card", "rounded-full");
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("menuitem", { name: messages.nav.prices }),
  ).toHaveAttribute("href", "/prices");
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
});
