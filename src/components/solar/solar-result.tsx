"use client";

import { InfoIcon, SunIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { DemoNote } from "@/components/app/page-parts";
import { cn } from "@/lib/utils";

import {
  type AreaUnit,
  fromSquareMetres,
  type Range,
  type SolarEstimate,
  type SolarResult,
  type UsageMode,
} from "./calc";
import { SavingsChart } from "./savings-chart";

function Figure({
  label,
  value,
  emphasis = false,
  className,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 border-s-2 px-4 py-3",
        emphasis ? "border-primary" : "border-border",
        className,
      )}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-semibold break-words tabular-nums",
          emphasis ? "text-xl text-foreground" : "text-lg",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** The estimate, or what's missing before there can be one. */
export function SolarResultView({
  result,
  mode,
  areaUnit,
}: {
  result: SolarResult | null;
  mode: UsageMode;
  areaUnit: AreaUnit;
}) {
  const t = useTranslations("solar.result");
  const format = useFormat();

  if (!result || result.status === "noUsage") {
    return (
      <div className="flex flex-col items-start gap-3 border-y border-dashed border-border py-10">
        <span className="flex size-12 items-center justify-center rounded-lg border bg-muted text-foreground">
          <SunIcon aria-hidden className="size-6" />
        </span>
        <p className="max-w-xs text-muted-foreground">{t("prompt")}</p>
      </div>
    );
  }

  const area = (m2: number) =>
    t("areaIn", {
      value: format.number(fromSquareMetres(m2, areaUnit)),
      unit: areaUnit,
    });

  if (result.status === "roofTooSmall") {
    return (
      <div className="flex items-start gap-3 border-s-2 border-attention bg-attention/20 p-5 text-attention-foreground">
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{t("roofTooSmallTitle")}</p>
          <p>{t("roofTooSmallBody", { area: area(result.minRoofM2) })}</p>
        </div>
      </div>
    );
  }

  return <Estimate estimate={result.estimate} mode={mode} area={area} />;
}

function Estimate({
  estimate,
  mode,
  area,
}: {
  estimate: SolarEstimate;
  mode: UsageMode;
  area: (m2: number) => string;
}) {
  const t = useTranslations("solar.result");
  const format = useFormat();
  const money = (rupees: number) => format.money(rupees * 100);
  const range = ({ low, high }: Range) =>
    low === high
      ? money(low)
      : t("range", { low: money(low), high: money(high) });

  let payback = t("noPayback");
  if (estimate.paybackYears) {
    const { low, high } = estimate.paybackYears;
    payback =
      low === high
        ? t("years", { count: low })
        : t("yearsRange", {
            low: format.number(low, 1),
            high: format.number(high, 1),
          });
  }

  return (
    <div className="flex flex-col gap-6 border-t border-border py-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t("size")}</p>
        <p className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("kw", { kw: format.number(estimate.kw, 1) })}
        </p>
        <p className="text-muted-foreground">
          {t("sizeHint", {
            units: format.number(estimate.monthlyGeneration),
            area: area(estimate.roofNeededM2),
          })}
        </p>
        {mode === "bill" ? (
          <p className="text-sm text-muted-foreground">
            {t("fromBill", { units: format.number(estimate.monthlyUnits) })}
          </p>
        ) : null}
        {estimate.limitedByRoof ? (
          <p className="mt-1 flex items-start gap-2 rounded-lg bg-attention/20 px-3 py-2 text-sm text-attention-foreground">
            <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("limitedByRoof")}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
        <Figure label={t("cost")} value={range(estimate.cost)} />
        <Figure
          label={t("subsidy")}
          value={
            estimate.kind === "home"
              ? t("minus", { amount: money(estimate.subsidy) })
              : t("noSubsidy")
          }
        />
        <Figure label={t("netCost")} value={range(estimate.netCost)} emphasis />
        <Figure
          label={t("savings")}
          value={t("perMonth", { amount: money(estimate.monthlySavings) })}
          emphasis
        />
        <Figure
          label={t("payback")}
          value={payback}
          emphasis
          className="sm:col-span-2"
        />
      </dl>

      <SavingsChart
        savingsByYear={estimate.savingsByYear}
        netCost={estimate.netCost}
      />

      <DemoNote>{t("demoNote")}</DemoNote>
    </div>
  );
}
