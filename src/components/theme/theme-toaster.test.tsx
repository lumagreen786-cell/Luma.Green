import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";

import { LocalizedThemeToaster, ThemeToaster } from "./theme-provider";

afterEach(() => {
  toast.dismiss();
});

describe("notification direction", () => {
  for (const [locale, direction, edge] of [
    ["en", "ltr", "right"],
    ["ar", "rtl", "left"],
    ["ur", "rtl", "left"],
  ] as const) {
    it(`places ${locale} notifications away from the navigation edge`, async () => {
      render(
        <NextIntlClientProvider locale={locale} messages={{}}>
          <LocalizedThemeToaster />
        </NextIntlClientProvider>,
      );
      act(() => {
        toast.error("Retry the action", { id: locale });
      });
      const message = await screen.findByText("Retry the action");
      const notifications = message.closest("ol");
      expect(notifications).toHaveAttribute("dir", direction);
      expect(notifications).toHaveAttribute("data-x-position", edge);
    });
  }

  it("renders the English admin notice without a locale provider", async () => {
    render(<ThemeToaster />);
    act(() => {
      toast.error("Admin retry", { id: "admin" });
    });
    const message = await screen.findByText("Admin retry");
    expect(message.closest("ol")).toHaveAttribute("dir", "ltr");
  });
});
