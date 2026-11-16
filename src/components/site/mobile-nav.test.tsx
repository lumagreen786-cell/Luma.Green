import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { MobileNav } from "./mobile-nav";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
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

it("enables the server-rendered menu only when its first click can open it", async () => {
  const ui = (
    <NextIntlClientProvider locale="en" messages={messages}>
      <MobileNav />
    </NextIntlClientProvider>
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui);
  document.body.append(container);
  const trigger = within(container).getByRole("button", { name: "Open menu" });
  expect(trigger).toBeDisabled();

  render(ui, { container, hydrate: true });
  expect(trigger).toBeEnabled();
  await userEvent.click(trigger);
  expect(screen.getByRole("dialog")).toBeVisible();
  const navigation = screen.getByRole("navigation", { name: "Main" });
  expect(navigation).not.toHaveClass("record-sheet", "rounded-full");
  expect(navigation).toHaveClass("flex-col");
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
