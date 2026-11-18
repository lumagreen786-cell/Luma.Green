import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import arabic from "../../../messages/ar.json";
import english from "../../../messages/en.json";
import { PublicBottomNav } from "./public-bottom-nav";

const location = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => location.pathname,
  Link: (props: ComponentProps<"a">) => <a {...props} />,
}));

function show(locale: "en" | "ar" = "en") {
  const messages = locale === "ar" ? arabic : english;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <label>
        Test field
        <input />
      </label>
      <PublicBottomNav />
    </NextIntlClientProvider>,
  );
}

describe("public bottom navigation", () => {
  beforeEach(() => {
    location.pathname = "/sell";
  });

  it.each(["/", "/business", "/business/recyclers"])(
    "does not render the dock on the marketing route %s",
    (pathname) => {
      location.pathname = pathname;
      show();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(screen.queryAllByRole("link")).toHaveLength(0);
    },
  );

  it("provides four labelled destinations and selects the current workflow", () => {
    show();
    const nav = screen.getByRole("navigation", {
      name: english.footer.useHeading,
    });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/", "/sell", "/prices", "/help"]);
    expect(within(nav).getByRole("link", { name: "Recycle" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("selects a nested section without selecting home", () => {
    location.pathname = "/sell/activity";
    show();
    expect(screen.getByRole("link", { name: "Recycle" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("hides the dock while entering a form value", () => {
    show();
    const input = screen.getByRole("textbox");
    input.focus();
    fireEvent.focusIn(input);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    input.blur();
    fireEvent.focusOut(input);
    expect(screen.getByRole("navigation")).toBeVisible();
  });

  it("uses translated visible labels for RTL", () => {
    show("ar");
    expect(screen.getByRole("link", { name: arabic.nav.home })).toBeVisible();
    expect(
      screen.getByRole("link", { name: arabic.nav.sellScrap }),
    ).toBeVisible();
  });
});
