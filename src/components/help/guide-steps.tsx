import { useFormatter, useTranslations } from "next-intl";

import type { Guide } from "./content";
import { IconTile } from "./help-art";

/** Ordered instructions keep their number, action and icon together. */
export function GuideSteps({ guide }: { guide: Guide }) {
  const t = useTranslations("help");
  const format = useFormatter();
  const total = guide.steps.length;
  return (
    <ol className="divide-y border-y">
      {guide.steps.map((step, index) => {
        const base = `guides.${guide.key}.steps.${step.key}`;
        return (
          <li key={step.key} className="flex gap-4 py-3 sm:gap-6">
            <span
              aria-hidden
              className="w-9 shrink-0 pt-1 font-mono text-xl text-muted-foreground tabular-nums"
            >
              {format.number(index + 1, { minimumIntegerDigits: 2 })}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="sr-only">
                {t("guide.stepLabel", { number: index + 1, total })}
              </p>
              <details open={index === 0}>
                <summary className="min-h-11 cursor-pointer py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <h3 className="inline text-lg font-semibold">
                    {t(`${base}.title`)}
                  </h3>
                </summary>
                <p className="py-3 leading-relaxed text-pretty text-muted-foreground">
                  {t(`${base}.body`)}
                </p>
              </details>
            </div>
            <IconTile icon={step.icon} size="sm" className="hidden sm:flex" />
          </li>
        );
      })}
    </ol>
  );
}
