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
  dashboard = false,
}: {
  className?: string;
  onNavigate?: () => void;
  tone?: "default" | "forest";
  dashboard?: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "record-sheet flex-wrap gap-1 rounded-full p-1.5 shadow-panel",
        className,
      )}
    >
      {(dashboard
        ? ([
            { href: "/", key: "home" },
            { href: "/sell", key: "sellScrap" },
            { href: "/prices", key: "prices" },
            { href: "/join", key: "join" },
          ] as const)
        : navItems
      ).map((item) => {
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
                "text-foreground hover:bg-muted focus-visible:ring-ring",
              isCurrent &&
                "gap-2 bg-primary text-primary-foreground before:size-1.5 before:rounded-full before:bg-primary-foreground before:content-['']",
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
