import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account/account-menu";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { SkipLink } from "@/components/site/skip-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Link } from "@/i18n/navigation";

import collectionPartners from "../../../../public/images/showcase/collection-partners.webp";

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
      <div className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16 lg:py-16">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-md min-w-0 flex-col justify-start lg:justify-start"
        >
          {children}
        </main>
        <aside className="hidden min-w-0 flex-col gap-6 border-s border-border ps-10 text-foreground lg:flex">
          <p className="max-w-md font-display text-2xl leading-tight font-semibold tracking-tight text-balance">
            {brand("tagline")}
          </p>
          <figure className="m-0">
            <div className="overflow-hidden">
              <Image
                src={collectionPartners}
                alt=""
                sizes="(min-width: 1024px) 320px, 92vw"
                className="aspect-[3/2] w-full object-cover"
              />
            </div>
          </figure>
          <p className="hidden text-sm font-medium text-muted-foreground lg:block">
            {brand("name")}
          </p>
        </aside>
      </div>
    </div>
  );
}
