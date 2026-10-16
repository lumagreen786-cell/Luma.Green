"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { navItems } from "./content";

/** The page itself or anything under it — `/help/kabadiwala` is in Help. */
export function isCurrentSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className={cn("gap-1", className)}>
      {navItems.map((item) => {
        const isCurrent = isCurrentSection(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center border-b-2 border-transparent px-2 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              isCurrent && "border-primary text-foreground",
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
