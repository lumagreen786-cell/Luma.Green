"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { SELL_STEPS, type SellStep } from "./draft";

function labelTone(index: number, current: number): string {
  if (index === current) return "font-semibold text-foreground";
  return index < current ? "text-primary" : "text-muted-foreground";
}

/** Connected steps show current progress and completed selections. */
export function StepIndicator({ step }: { step: SellStep }) {
  const t = useTranslations("sell.steps");
  const current = SELL_STEPS.indexOf(step);
  return (
    <nav aria-label={t("label")} className="py-2">
      <p className="sr-only" aria-live="polite">
        {t("progress", { current: current + 1, total: SELL_STEPS.length })}
      </p>
      <ol className="grid grid-cols-4 gap-3">
        {SELL_STEPS.map((name, index) => (
          <li
            key={name}
            aria-current={index === current ? "step" : undefined}
            className="flex min-w-0 flex-col gap-3"
          >
            <span
              aria-hidden
              className={cn(
                "h-1 w-full rounded-full",
                index <= current ? "bg-primary" : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-xs leading-relaxed wrap-anywhere",
                labelTone(index, current),
              )}
            >
              {t(name)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
