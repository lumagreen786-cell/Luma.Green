import {
  ArrowRightIcon,
  FactoryIcon,
  HandHelpingIcon,
  HouseIcon,
  RecycleIcon,
  StoreIcon,
  WarehouseIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { HELP_ROLES, type HelpRole, ROLE_HELP } from "./content";
import { IconTile } from "./help-art";

const roleIcons = {
  household: HouseIcon,
  kabadiwala: StoreIcon,
  yard: WarehouseIcon,
  recycler: RecycleIcon,
  manufacturer: FactoryIcon,
  saathi: HandHelpingIcon,
} as const;

/**
 * One divided row per role, with its guide count and a clear destination.
 */
export function RoleCards() {
  const t = useTranslations("help");
  return (
    <ul className="divide-y divide-border rounded-panel bg-card px-5 shadow-panel sm:px-7">
      {HELP_ROLES.map((role) => (
        <li
          key={role}
          data-reveal
          className="group relative flex min-w-0 gap-4 py-5 transition-colors has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50"
        >
          <div className="pt-0.5">
            <IconTile icon={roleIcons[role]} size="sm" />
          </div>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <h3 className="text-base font-semibold tracking-tight">
              <Link
                href={`/help/${role}`}
                className="outline-none after:absolute after:inset-0"
              >
                {t(`roles.${role}.name`)}
              </Link>
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground sm:col-start-1">
              {t(`roles.${role}.who`)}
            </p>
            <p className="flex items-center justify-between gap-5 text-sm font-medium text-foreground sm:col-start-2 sm:row-span-2 sm:row-start-1">
              {t("guideCount", { count: ROLE_HELP[role].guides.length })}
              <ArrowRightIcon
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              />
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Compact links to every other role's help, at the foot of a role page. */
export function OtherRoleLinks({ current }: { current: HelpRole }) {
  const t = useTranslations("help");
  return (
    <ul className="flex flex-wrap gap-2">
      {HELP_ROLES.filter((role) => role !== current).map((role) => (
        <li key={role}>
          <Link
            href={`/help/${role}`}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full bg-card px-4 text-sm font-medium outline-none",
              "hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            {t(`roles.${role}.name`)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
