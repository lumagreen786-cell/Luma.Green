import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { RoleCards } from "./role-cards";

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

describe("RoleCards", () => {
  it("offers every role with a concise description and a way in", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RoleCards />
      </NextIntlClientProvider>,
    );

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/join/kabadiwala",
      "/join/yard",
      "/join/recycler",
      "/join/manufacturer",
      "/join/saathi",
    ]);
    expect(screen.getByRole("link", { name: /Saathi/ })).toHaveTextContent(
      messages.join.roles.saathi.body,
    );
  });
});
