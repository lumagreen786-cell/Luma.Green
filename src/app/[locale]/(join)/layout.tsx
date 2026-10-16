import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account/account-menu";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/join/sign-out-button";
import { EntryStory } from "@/components/showcase/entry-story";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { SkipLink } from "@/components/site/skip-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Link } from "@/i18n/navigation";

/** Fallback for new applicant pages; public /join uses the site layout. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
  openGraph: null,
  twitter: null,
};

/**
 * Shell for applicants: a form with desktop imagery and a way out.
 * Every page here is private and checks the session itself.
 */
export default async function JoinLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("nav");
  const brand = await getTranslations("brand");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-8">
        <Link
          href="/"
          aria-label={t("home")}
          className="inline-flex min-h-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <div className="xl:hidden">
          <AccountMenu />
        </div>
        <div className="hidden items-center gap-1 xl:flex">
          <ThemeToggle />
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-8 px-4 py-6 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] lg:gap-16">
        <main id="main" tabIndex={-1} className="min-w-0">
          {children}
        </main>
        <EntryStory
          scene="kabadiwala"
          title={brand("tagline")}
          caption={brand("name")}
          className="hidden lg:sticky lg:top-24 lg:flex"
        />
      </div>
    </div>
  );
}
