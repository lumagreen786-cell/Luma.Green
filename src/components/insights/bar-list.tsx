import type { LucideIcon } from "lucide-react";

export interface BarListRow {
  key: string;
  label: string;
  icon: LucideIcon;
  /** What the bar's length encodes. */
  value: number;
  /** The value as people read it, shown at the end of the row. */
  display: string;
  detail?: string;
}

/** A bar's length as a share of the longest, in whole percent (0–100). */
export function barPercent(value: number, max: number): number {
  return max <= 0 || value <= 0
    ? 0
    : Math.min(100, Math.max(1, Math.round((value / max) * 100)));
}

/**
 * A small horizontal bar chart for one measure across a few categories.
 * Every value is also written out, so the bars only add the comparison.
 */
export function BarList({
  label,
  rows,
}: {
  label: string;
  rows: BarListRow[];
}) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  return (
    <ul aria-label={label} className="flex flex-col gap-5">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <li key={row.key} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <Icon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="break-words">{row.label}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {row.display}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                aria-hidden
                data-testid="bar"
                className="florin-bar h-2.5 rounded-full bg-primary"
                style={{ width: `${String(barPercent(row.value, max))}%` }}
              />
            </div>
            {row.detail ? (
              <span className="text-xs text-muted-foreground">
                {row.detail}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
