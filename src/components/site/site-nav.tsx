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
  tone = "default",
}: {
  className?: string;
  onNavigate?: () => void;
  tone?: "default" | "forest";
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className={cn("flex-wrap gap-1", className)}>
      {navItems.map((item) => {
        const isCurrent = isCurrentSection(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 max-w-full items-center rounded-full px-3 py-2 text-sm font-medium break-words whitespace-normal text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              tone === "forest" &&
                "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
              isCurrent && "bg-secondary text-secondary-foreground",
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
