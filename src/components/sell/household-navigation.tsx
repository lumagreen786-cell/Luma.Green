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
      className="overflow-x-auto border-y border-border"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-[repeat(5,minmax(max-content,1fr))]">
        {tabs.map(({ label, href, icon: Icon }) => (
          <li key={href} className="min-w-0">
            <Link
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 border-b-2 border-transparent px-2 py-2 text-center text-xs font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:border-primary aria-[current=page]:text-primary"
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
