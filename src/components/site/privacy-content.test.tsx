import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { site } from "@/lib/site";

import arabic from "../../../messages/ar.json";
import english from "../../../messages/en.json";
import kannada from "../../../messages/kn.json";
import { PrivacyContent } from "./privacy-content";

vi.mock("@/i18n/navigation", () => ({
  Link: (props: ComponentProps<"a">) => <a {...props} />,
}));

const catalogues = { en: english, ar: arabic, kn: kannada };

describe("public privacy and deletion instructions", () => {
  it.each(["en", "ar", "kn"] as const)(
    "shows data choices and deletion paths without signing in (%s)",
    (locale) => {
      const messages = catalogues[locale];
      render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PrivacyContent />
        </NextIntlClientProvider>,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        messages.privacy.title,
      );
      expect(screen.getByText(messages.privacy.retentionBody)).toBeVisible();
      expect(
        screen.getByRole("link", { name: messages.privacyRequests.title }),
      ).toHaveAttribute("href", "/account/privacy");
      expect(
        screen.getByRole("link", { name: messages.accountRemoval.title }),
      ).toHaveAttribute("href", "/account/removal");
      expect(
        screen.getByRole("link", { name: site.supportEmail }),
      ).toHaveAttribute("href", `mailto:${site.supportEmail}`);
      expect(
        screen.getByRole("region", { name: messages.privacy.requestsTitle }),
      ).toHaveAttribute("id", "requests");
      const sections = screen.getAllByRole("region");
      expect(sections).toHaveLength(5);
      const index = screen.getByRole("navigation", {
        name: messages.privacy.title,
      });
      const links = within(index).getAllByRole("link");
      expect(links).toHaveLength(sections.length);
      for (const section of sections) {
        const heading = within(section).getByRole("heading");
        expect(
          within(index).getByRole("link", { name: heading.textContent }),
        ).toHaveAttribute("href", `#${section.id}`);
      }
    },
  );
});
