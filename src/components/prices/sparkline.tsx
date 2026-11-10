"use client";

import { useId } from "react";

import { areaPath, linearScale, linePath } from "@/components/site/chart-kit";
import { cn } from "@/lib/utils";

import { dayNumber, type PricePoint, seriesRange } from "./board";

const PAD = 5;

/**
 * A month of prices at a glance. Decorative: the numbers it summarises are
 * printed beside it, and the full chart is one tap away.
 */
export function Sparkline({
  series,
  width = 88,
  height = 32,
  className,
}: {
  series: readonly PricePoint[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const patternId = useId();
  const range = seriesRange(series);
  const first = series.at(0);
  const last = series.at(-1);
  if (!range || !first || !last || series.length < 2) {
    return (
      <span
        aria-hidden
        className={cn("block", className)}
        style={{ width, height }}
      />
    );
  }

  const x = linearScale(
    [dayNumber(first.date), dayNumber(last.date)],
    [PAD, width - PAD],
  );
  const y = linearScale([range.low, range.high], [height - PAD, PAD]);
  const points = series.map((point) => ({
    x: x(dayNumber(point.date)),
    y: y(point.paisePerKg),
  }));
  const end = points.at(-1) ?? { x: 0, y: 0 };

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className={cn("block shrink-0 overflow-visible", className)}
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
      <path d={areaPath(points, height - PAD)} fill={`url(#${patternId})`} />
      <path
        d={linePath(points)}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-primary"
      />
      <circle
        cx={end.x}
        cy={end.y}
        r={4}
        strokeWidth={2}
        className="fill-primary stroke-card"
      />
    </svg>
  );
}
