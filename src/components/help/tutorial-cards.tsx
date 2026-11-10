import { ClockIcon, VideoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { type HelpRole, tutorialsFor } from "./content";

/** Planned videos are compact information rows, with no inactive play control. */
export function TutorialCards({ role }: { role: HelpRole }) {
  const t = useTranslations("help");
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4 sm:px-5">
      {tutorialsFor(role).map(({ key, minutes }) => (
        <li
          key={key}
          className="flex items-start gap-4 py-5 sm:items-center sm:py-6"
        >
          <VideoIcon
            aria-hidden
            className="mt-1 size-6 shrink-0 text-muted-foreground sm:mt-0"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="space-y-1">
              <h3 className="font-medium">{t(`tutorials.${key}`)}</h3>
              <p className="text-sm text-muted-foreground">
                {t("tutorial.comingSoon")}
              </p>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ClockIcon aria-hidden className="size-4" />
              {t("tutorial.minutes", { minutes })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
