import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { trendOf } from "./board";

const icons = {
  up: ArrowUpIcon,
  down: ArrowDownIcon,
  flat: MinusIcon,
  unknown: MinusIcon,
} as const;

/**
 * The week's change as an arrow and a percentage. Colour is never the only
 * cue: the arrow shows the direction, and screen readers hear it in words.
 */
export function PriceChange({
  changePct,
  className,
}: {
  changePct: number | null;
  className?: string;
}) {
  const t = useTranslations("prices.change");
  const format = useFormatter();
  const trend = trendOf(changePct);
  const Icon = icons[trend];
  const pct =
    changePct === null
      ? ""
      : format.number(Math.abs(changePct) / 100, {
          style: "percent",
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
        trend === "up" && "bg-accent text-accent-foreground",
        trend === "down" && "bg-attention/40 text-attention-foreground",
        (trend === "flat" || trend === "unknown") &&
          "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span aria-hidden>{trend === "unknown" ? "–" : pct}</span>
      <span className="sr-only">{t(trend, { pct })}</span>
    </span>
  );
}
