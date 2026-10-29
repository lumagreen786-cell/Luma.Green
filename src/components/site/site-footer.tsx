import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { Container } from "./container";
import { footerGroups } from "./content";

const linkClass =
  "inline-flex min-h-11 max-w-full items-center text-muted-foreground [overflow-wrap:anywhere] outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

export async function SiteFooter() {
  const [t, brand, labels] = await Promise.all([
    getTranslations("footer"),
    getTranslations("brand"),
    getTranslations(),
  ]);
  return (
    <footer className="mt-auto bg-muted/40">
      <Container>
        <div className="flex flex-col items-start gap-6 py-10 sm:flex-row sm:items-center sm:justify-between lg:py-14">
          <p className="max-w-2xl font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            {brand("tagline")}
          </p>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/sell">
              {labels("nav.sellScrap")}
              <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm text-muted-foreground">
              {t("copyright")}
            </p>
          </div>
          <nav
            aria-label={t("navLabel")}
            className="grid grid-cols-2 gap-6 sm:gap-12"
          >
            {footerGroups.map((group) => (
              <div key={group.heading}>
                <h2 className="mb-3 text-sm font-semibold">
                  {t(group.heading)}
                </h2>
                <ul className="space-y-1 text-sm">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={linkClass}>
                        {labels(link.label)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
