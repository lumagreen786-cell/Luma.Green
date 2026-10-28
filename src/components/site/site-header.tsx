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

export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <Container className="flex min-h-20 items-center gap-4 py-3 lg:px-8 xl:gap-5">
        <Link
          href="/"
          aria-label={t("home")}
          className="inline-flex min-h-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo className="gap-2 [&>span]:text-lg [&>svg]:size-7" />
        </Link>
        <SiteNav className="mx-auto hidden min-w-0 xl:flex" />
        <div className="ms-auto hidden shrink-0 items-center gap-1 xl:flex">
          <ThemeToggle />
          <LanguageSwitcher />
          <HeaderAuthAction className="px-3" />
          <Button asChild size="default" className="ms-2 px-5">
            <Link href="/sell">{t("sellScrap")}</Link>
          </Button>
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <NativeUpdateControl compact />
          <MobileNav className="xl:hidden" />
        </div>
      </Container>
    </header>
  );
}
