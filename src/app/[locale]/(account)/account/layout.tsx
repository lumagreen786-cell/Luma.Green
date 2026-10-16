import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AccountLinks } from "@/components/account/account-links";
import { AccountMenu } from "@/components/account/account-menu";
import { Logo } from "@/components/brand/logo";
import { SkipLink } from "@/components/site/skip-link";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Household, applicant and operator settings share identity, not org approval. */
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("nav");
  const account = await getTranslations("accountSecurity");
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <header className="flex min-h-16 items-center justify-between gap-2 border-b px-4 py-2 sm:px-8">
        <Link
          href="/"
          aria-label={t("home")}
          className="inline-flex min-h-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <AccountMenu />
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:py-8">
        <nav
          aria-label={account("title")}
          className="hidden self-start border-e border-border pe-6 lg:grid lg:gap-1"
        >
          <AccountLinks className="border-s-2 border-transparent px-3 hover:bg-muted" />
        </nav>
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
