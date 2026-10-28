import { render, screen } from "@testing-library/react";
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
        screen.getByRole("link", { name: messages.accountRemoval.title }),
      ).toHaveAttribute("href", "/account/removal");
      expect(
        screen.getByRole("link", { name: site.supportEmail }),
      ).toHaveAttribute("href", `mailto:${site.supportEmail}`);
      expect(
        screen.getByRole("region", { name: messages.privacy.requestsTitle }),
      ).toHaveAttribute("id", "requests");
      expect(screen.getAllByRole("region")).toHaveLength(5);
    },
  );
});
