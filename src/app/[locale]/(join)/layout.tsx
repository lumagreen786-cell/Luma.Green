import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account/account-menu";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/join/sign-out-button";
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
 * Shell for applicants: one phone-width column, the language switcher and a
 * way out. Every page here is private and checks the session itself.
 */
export default async function JoinLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("nav");

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
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10"
      >
        {children}
      </main>
    </div>
  );
}
