"use client";

import { BellIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function AccountLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const workspace = useTranslations("workspace");
  const security = useTranslations("accountSecurity");
  const notifications = useTranslations("notifications");
  const reports = useTranslations("auditReports");
  const pathname = usePathname();
  const items = [
    { href: "/account/workspaces", label: workspace("title"), icon: UsersIcon },
    {
      href: "/account/notifications",
      label: notifications("title"),
      icon: BellIcon,
    },
    {
      href: "/account/security",
      label: security("title"),
      icon: ShieldCheckIcon,
    },
    {
      href: "/account/reports",
      label: reports("title"),
      icon: ShieldCheckIcon,
    },
  ];
  return items.map(({ href, label, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      onClick={onNavigate}
      aria-current={pathname === href ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center gap-3 py-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pathname === href && "font-semibold text-primary",
        className,
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span>{label}</span>
    </Link>
  ));
}
