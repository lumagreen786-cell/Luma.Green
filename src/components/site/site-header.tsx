import { getTranslations } from "next-intl/server";

import { NativeUpdateControl } from "@/components/app/native-update-control";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { Container } from "./container";
import { HeaderAuthAction } from "./header-auth-action";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { SiteNav } from "./site-nav";
import { SitePageSwitcher } from "./site-page-switcher";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
      <Container className="flex min-h-18 items-center gap-2 py-2 sm:min-h-18 sm:gap-4 sm:py-3 lg:px-8 xl:gap-5">
        <Link
          href="/"
          aria-label={t("home")}
          className="inline-flex min-h-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo className="gap-2 [&>span]:text-lg [&>svg]:size-7" />
        </Link>
        <div className="hidden sm:block">
          <SitePageSwitcher />
        </div>
        <SiteNav
          dashboard
          tone="forest"
          className="me-auto hidden min-w-0 xl:flex"
        />
        <div className="ms-auto hidden shrink-0 items-center gap-1 xl:flex">
          <LanguageSwitcher className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <HeaderAuthAction className="px-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <Button
            asChild
            size="default"
            className="ms-2 bg-sidebar-primary px-5 text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
          >
            <Link href="/sell">{t("sellScrap")}</Link>
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-2 max-xl:ms-auto">
          <ThemeToggle />
          <NativeUpdateControl compact />
          <MobileNav className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground xl:hidden" />
        </div>
      </Container>
    </header>
  );
}
