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
      className="bg-foreground px-4 py-3 text-background"
    >
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        {tabs.map(({ label, href, icon: Icon }) => (
          <li key={href} className="max-w-full min-w-0">
            <Link
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-center text-sm font-medium outline-none hover:bg-background/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className="break-words">{t(label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
