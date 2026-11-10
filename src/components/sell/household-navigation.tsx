"use client";

import {
  FootprintsIcon,
  HistoryIcon,
  LeafIcon,
  SettingsIcon,
  WrenchIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

const tabs = [
  { label: "recycle", href: "/sell", icon: LeafIcon },
  { label: "activity", href: "/sell/activity", icon: HistoryIcon },
  { label: "services", href: "/sell/services", icon: WrenchIcon },
  { label: "footprint", href: "/sell/footprint", icon: FootprintsIcon },
  { label: "settings", href: "/sell/settings", icon: SettingsIcon },
] as const;

export function HouseholdNavigation() {
  const t = useTranslations("householdTools");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("navigation")}
      className="overflow-x-auto overscroll-x-contain border-b border-border/60 bg-card px-4 py-2"
    >
      <ul className="mx-auto grid w-max min-w-full grid-cols-[repeat(5,minmax(max-content,1fr))] gap-2 sm:max-w-2xl sm:min-w-0">
        {tabs.map(({ label, href, icon: Icon }) => (
          <li key={href} className="min-w-0">
            <Link
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-full px-4 py-2 text-center text-xs font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className="whitespace-nowrap">{t(label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
