import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

import { Container } from "./container";
import { footerGroups } from "./content";

export async function SiteFooter() {
  const [t, labels] = await Promise.all([
    getTranslations("footer"),
    getTranslations(),
  ]);
  return (
    <footer className="mt-auto py-5">
      <Container>
        <div className="rounded-[1.75rem] border border-border/60 bg-card px-5 py-4 text-card-foreground">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <Logo
              idPrefix="site-footer"
              className="gap-2 [&>span]:text-base [&>svg]:size-6"
            />
            <p className="text-xs text-muted-foreground">{t("copyright")}</p>
          </div>
          <nav
            aria-label={t("navLabel")}
            className="mt-3 border-t border-border/60 pt-2"
          >
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {footerGroups.map((group) =>
                group.links.map((link) => (
                  <li key={link.href} className="max-w-full min-w-0">
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 max-w-full items-center rounded-full py-2 text-xs [overflow-wrap:anywhere] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {labels(link.label)}
                    </Link>
                  </li>
                )),
              )}
            </ul>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
