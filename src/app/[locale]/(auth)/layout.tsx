import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account/account-menu";
import { Logo } from "@/components/brand/logo";
import { EntryStory } from "@/components/showcase/entry-story";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { SkipLink } from "@/components/site/skip-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Link } from "@/i18n/navigation";

/**
 * Shell for signing in: a focused form and a quiet brand panel. Pages
 * here are private — each sets `privateMetadata()` (docs/architecture/urls.md).
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("nav");
  const brand = await getTranslations("brand");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <header className="flex min-h-16 items-center justify-between gap-2 border-b border-border bg-background px-4 py-2 sm:px-8">
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
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-8 px-4 py-6 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:py-12">
        <main
          id="main"
          tabIndex={-1}
          className="order-2 mx-auto flex w-full max-w-md min-w-0 flex-col justify-start lg:order-1 lg:py-8"
        >
          {children}
        </main>
        <EntryStory
          scene="saathi"
          title={brand("tagline")}
          caption={brand("name")}
          className="order-1 mx-auto w-full max-w-md lg:order-2"
        />
      </div>
    </div>
  );
}
