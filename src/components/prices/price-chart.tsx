"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo } from "react";

import { useFormat } from "@/components/app/format";
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

import type { PricePoint } from "./board";
import { PRICE_CHART, priceChartGeometry } from "./chart-geometry";

const TOOLTIP_HALF_WIDTH = 64;

/**
 * Thirty days of one material's price: a line with a soft wash, the floor as
 * a dashed threshold, and a crosshair that follows the pointer or the arrow
 * keys. A table of the same numbers sits underneath for anyone who'd rather
 * read than hover.
 */
export function PriceChart({
  series,
  floorPaise,
  material,
}: {
  series: readonly PricePoint[];
  floorPaise: number | null;
  material: string;
}) {
  const patternId = useId();
  const t = useTranslations("prices.chart");
  const format = useFormat();
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const geometry = useMemo(
    () => priceChartGeometry(series, floorPaise, width),
    [series, floorPaise, width],
  );
  const { active, handlers } = useChartCursor(geometry?.xs ?? []);

  if (!geometry) return null;

  const { plot, points, yTicks, floorY } = geometry;
  const lastIndex = points.length - 1;
  const current = active ?? lastIndex;
  const currentPoint = series.at(current);
  const activePoint = active === null ? undefined : points.at(active);
  const end = points.at(-1);
  const lastPrice = series.at(-1);
  const middle = Math.floor(lastIndex / 2);
  const xLabels = [...new Set([0, middle, lastIndex])];

  return (
    <div className="flex flex-col gap-3">
      <div ref={ref} dir="ltr" className="relative w-full">
        <div
          role="slider"
          tabIndex={0}
          aria-label={t("label", { material })}
          aria-valuemin={0}
          aria-valuemax={lastIndex}
          aria-valuenow={current}
          aria-valuetext={
            currentPoint
              ? t("point", {
                  date: format.date(currentPoint.date),
                  price: format.perKg(currentPoint.paisePerKg),
                })
              : undefined
          }
          onPointerDown={handlers.onPointerMove}
          {...handlers}
          className="touch-pan-y rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <svg
            aria-hidden
            width={width}
            height={PRICE_CHART.height}
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
              <g key={tick.paise}>
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
                  {format.perKg(tick.paise)}
                </text>
              </g>
            ))}

            {floorY === null || floorPaise === null ? null : (
              <g>
                <line
                  x1={plot.left}
                  x2={plot.right}
                  y1={floorY}
                  y2={floorY}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  className="stroke-muted-foreground"
                />
                <text
                  x={plot.left + 4}
                  y={floorY - 6}
                  className="fill-muted-foreground text-[11px]"
                >
                  {t("floor", { price: format.perKg(floorPaise) })}
                </text>
              </g>
            )}

            <path d={geometry.area} fill={`url(#${patternId})`} />
            <path
              d={geometry.line}
              fill="none"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-primary"
            />

            {xLabels.map((index) => {
              const point = points.at(index);
              const day = series.at(index);
              if (!point || !day) return null;
              let anchor: "start" | "middle" | "end" = "middle";
              if (index === 0) anchor = "start";
              else if (index === lastIndex) anchor = "end";
              return (
                <text
                  key={day.date}
                  x={point.x}
                  y={plot.bottom + 20}
                  textAnchor={anchor}
                  className="fill-muted-foreground text-[11px]"
                >
                  {format.date(day.date)}
                </text>
              );
            })}

            {end && lastPrice ? (
              <g>
                <circle
                  cx={end.x}
                  cy={end.y}
                  r={4}
                  strokeWidth={2}
                  className="fill-primary stroke-card"
                />
                <text
                  x={end.x + 8}
                  y={end.y}
                  dy="0.32em"
                  className="fill-foreground text-xs font-medium tabular-nums"
                >
                  {format.perKg(lastPrice.paisePerKg)}
                </text>
              </g>
            ) : null}

            {activePoint ? (
              <g>
                <line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={plot.top}
                  y2={plot.bottom}
                  strokeWidth={1}
                  className="stroke-foreground/30"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r={5}
                  strokeWidth={2}
                  className="fill-primary stroke-card"
                />
              </g>
            ) : null}
          </svg>
        </div>

        {activePoint && currentPoint ? (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col items-center rounded-md border bg-popover px-2.5 py-1.5 text-center shadow-sm"
            style={{
              left: Math.min(
                Math.max(activePoint.x, TOOLTIP_HALF_WIDTH),
                width - TOOLTIP_HALF_WIDTH,
              ),
              top: Math.max(activePoint.y - 56, 0),
            }}
          >
            <span className="text-sm font-semibold tabular-nums">
              {format.perKg(currentPoint.paisePerKg)}
            </span>
            <span className="text-xs text-muted-foreground">
              {format.date(currentPoint.date)}
            </span>
          </div>
        ) : null}
      </div>

      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {t("table")}
        </summary>
        <Table className="mt-2">
          <caption className="sr-only">
            {t("tableCaption", { material })}
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead className="text-end">{t("price")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.toReversed().map((point) => (
              <TableRow key={point.date}>
                <TableCell>{format.date(point.date)}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {format.perKg(point.paisePerKg)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </div>
  );
}
