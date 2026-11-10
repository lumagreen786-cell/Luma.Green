"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useMemo } from "react";

import { numberLocale, useFormat } from "@/components/app/format";
import { areaPath, linePath } from "@/components/site/chart-kit";
import { useChartCursor } from "@/components/site/use-chart-cursor";
import { useElementWidth } from "@/components/site/use-element-width";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { Range } from "./calc";
import { SAVINGS_CHART, savingsGeometry } from "./chart-geometry";

const TOOLTIP_HALF_WIDTH = 72;

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn("inline-block h-3 w-4 rounded-sm", swatch)}
      />
      {label}
    </li>
  );
}

/**
 * Savings so far, year by year, against what the system costs after the
 * subsidy (a band, as the cost is a range). Points turn deep green once
 * they clear the band. Hover, tap or use the arrow keys for each year.
 */
export function SavingsChart({
  savingsByYear,
  netCost,
}: {
  savingsByYear: readonly { year: number; saved: number }[];
  netCost: Range;
}) {
  const patternId = useId();
  const titleId = useId();
  const t = useTranslations("solar.chart");
  const format = useFormat();
  const intl = useFormatter();
  const locale = useLocale();
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const geometry = useMemo(
    () => savingsGeometry(savingsByYear, netCost, width),
    [savingsByYear, netCost, width],
  );
  const centres = useMemo(
    () => geometry?.bars.map((bar) => bar.centre) ?? [],
    [geometry],
  );
  const { active, handlers } = useChartCursor(centres);

  if (!geometry) return null;

  const { plot, yTicks, band, bars } = geometry;
  const money = (rupees: number) => format.money(rupees * 100);
  const compact = (rupees: number) =>
    new Intl.NumberFormat(numberLocale(locale), {
      style: "currency",
      currency: "INR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(rupees);
  const current = bars.at(active ?? -1);
  const activeBar = active === null ? undefined : bars.at(active);
  const first = bars.at(0);
  const last = bars.at(-1);

  return (
    <figure aria-labelledby={titleId} className="flex flex-col gap-4">
      <figcaption className="flex flex-col gap-2">
        <span id={titleId} className="font-semibold">
          {t("title", { years: bars.length })}
        </span>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <LegendItem swatch="bg-chart-3" label={t("legendPaying")} />
          <LegendItem swatch="bg-primary" label={t("legendPaid")} />
          <LegendItem
            swatch="border border-dashed border-muted-foreground bg-muted-foreground/10"
            label={t("legendCost")}
          />
        </ul>
      </figcaption>

      <div ref={ref} dir="ltr" className="relative w-full">
        <div
          role="slider"
          tabIndex={0}
          aria-label={t("label")}
          aria-valuemin={first?.year ?? 1}
          aria-valuemax={last?.year ?? 1}
          aria-valuenow={current?.year}
          aria-valuetext={
            current
              ? t("point", { year: current.year, amount: money(current.saved) })
              : undefined
          }
          onPointerDown={handlers.onPointerMove}
          {...handlers}
          className="touch-pan-y rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <svg
            aria-hidden
            width={width}
            height={SAVINGS_CHART.height}
            className="block"
          >
            <defs>
              <pattern
                id={patternId}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(35)"
              >
                <rect width="7" height="7" className="fill-primary/5" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="7"
                  className="stroke-primary/25"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={plot.left}
                  x2={plot.right}
                  y1={tick.y}
                  y2={tick.y}
                  strokeWidth={1}
                  className="stroke-border"
                />
                <text
                  x={plot.left - 8}
                  y={tick.y}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {compact(tick.value)}
                </text>
              </g>
            ))}

            <rect
              x={plot.left}
              y={band.top}
              width={plot.right - plot.left}
              height={Math.max(band.bottom - band.top, 1)}
              className="fill-muted-foreground/10"
            />
            {[band.top, band.bottom].map((y) => (
              <line
                key={y}
                x1={plot.left}
                x2={plot.right}
                y1={y}
                y2={y}
                strokeWidth={1}
                strokeDasharray="4 4"
                className="stroke-muted-foreground"
              />
            ))}

            <path
              d={areaPath(
                bars.map((bar) => ({ x: bar.centre, y: bar.topY })),
                plot.bottom,
              )}
              fill={`url(#${patternId})`}
            />
            <path
              d={linePath(bars.map((bar) => ({ x: bar.centre, y: bar.topY })))}
              fill="none"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-primary"
            />
            {bars.map((bar, index) => (
              <circle
                key={bar.year}
                cx={bar.centre}
                cy={bar.topY}
                r={active === index ? 5 : 3}
                strokeWidth={2}
                className={cn(
                  "stroke-primary",
                  bar.paidBack ? "fill-primary" : "fill-chart-3",
                )}
              />
            ))}

            <text
              x={plot.left + 4}
              y={band.top - 6}
              className="fill-muted-foreground text-[11px]"
            >
              {t("legendCost")}
            </text>

            {last ? (
              <text
                x={last.x + last.width}
                y={last.topY - 6}
                textAnchor="end"
                className="fill-foreground text-xs font-medium tabular-nums"
              >
                {compact(last.saved)}
              </text>
            ) : null}

            {bars.map((bar) => (
              <text
                key={bar.year}
                x={bar.centre}
                y={plot.bottom + 18}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {intl.number(bar.year)}
              </text>
            ))}
          </svg>
        </div>

        {activeBar ? (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col items-center rounded-md border bg-popover px-2.5 py-1.5 text-center shadow-sm"
            style={{
              left: Math.min(
                Math.max(activeBar.centre, TOOLTIP_HALF_WIDTH),
                width - TOOLTIP_HALF_WIDTH,
              ),
              top: Math.max(activeBar.topY - 60, 0),
            }}
          >
            <span className="text-sm font-semibold tabular-nums">
              {money(activeBar.saved)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("yearLabel", { year: activeBar.year })}
            </span>
          </div>
        ) : null}
      </div>

      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {t("table")}
        </summary>
        <Table className="mt-2">
          <caption className="sr-only">{t("tableCaption")}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("year")}</TableHead>
              <TableHead className="text-end">{t("saved")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bars.map((bar) => (
              <TableRow key={bar.year}>
                <TableCell>{intl.number(bar.year)}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {money(bar.saved)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </figure>
  );
}
