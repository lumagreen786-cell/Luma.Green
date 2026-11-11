import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account/account-menu";
import { Logo } from "@/components/brand/logo";
import { SkipLink } from "@/components/site/skip-link";
import { Link } from "@/i18n/navigation";

/**
 * The household's own pages (booking tracking): private, never indexed
 * (docs/architecture/urls.md#indexing). Each page sets `privateMetadata()`;
 * this is the fallback for anything that doesn't.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** A phone-width column with the mark and the language switcher. */
export default async function HouseholdLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("nav");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <header className="flex min-h-16 items-center justify-between gap-2 border-b border-border/60 bg-card px-4 py-2">
        <Link
          href="/"
          aria-label={t("home")}
          className="inline-flex min-h-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <AccountMenu />
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto my-6 flex w-[calc(100%-2rem)] max-w-6xl flex-1 flex-col py-2 sm:my-8"
      >
        {children}
      </main>
    </div>
  );
}
