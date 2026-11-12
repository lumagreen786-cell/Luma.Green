import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { guidesFor, type HelpRole } from "./content";
import { IconTile } from "./help-art";

/** A role's guides as a divided reading list with a step count. */
export function GuideCards({ role }: { role: HelpRole }) {
  const t = useTranslations("help");
  return (
    <ul className="divide-y divide-border/60">
      {guidesFor(role).map(({ key, slug, icon, steps }) => (
        <li
          key={key}
          data-reveal
          className="group relative flex gap-4 py-4 transition-colors hover:bg-muted/30 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50 sm:gap-5"
        >
          <IconTile icon={icon} size="sm" />
          <div className="grid min-w-0 flex-1 gap-2 md:items-center md:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
            <h3 className="text-base font-semibold tracking-tight">
              <Link
                href={`/help/${role}/${slug}`}
                className="outline-none after:absolute after:inset-0"
              >
                {t(`guides.${key}.title`)}
              </Link>
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(`guides.${key}.summary`)}
            </p>
            <p className="flex items-center justify-between gap-5 text-sm font-medium text-foreground">
              {t("role.steps", { count: steps.length })}
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
