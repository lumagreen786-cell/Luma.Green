import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

import { Container } from "./container";
import { footerGroups } from "./content";

const linkClass =
  "inline-flex min-h-11 items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

export async function SiteFooter() {
  const [t, brand, labels] = await Promise.all([
    getTranslations("footer"),
    getTranslations("brand"),
    getTranslations(),
  ]);

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <Container className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm font-medium">{brand("tagline")}</p>
        </div>
        <nav aria-label={t("navLabel")} className="grid grid-cols-2 gap-8">
          {footerGroups.map((group) => (
            <div key={group.heading} className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">
                {t(group.heading)}
              </h2>
              <ul className="grid gap-1 text-sm">
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
      </Container>
      <div className="border-t border-border">
        <Container className="py-6 text-xs text-muted-foreground">
          {t("copyright")}
        </Container>
      </div>
    </footer>
  );
}
