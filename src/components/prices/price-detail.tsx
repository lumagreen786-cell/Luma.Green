"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { type PriceRow, seriesRange } from "./board";
import { PriceChange } from "./price-change";
import { PriceChart } from "./price-chart";

function Figure({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border-b border-border py-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold">
        {value}
        {extra}
      </dd>
    </div>
  );
}

/** A material's month in detail: the figures, the chart and the numbers. */
export function PriceDetail({ row }: { row: PriceRow }) {
  const t = useTranslations("prices");
  const format = useFormat();
  const name = format.material(row.names, row.code);
  const range = seriesRange(row.series);
  const perKg = (paise: number | null) =>
    paise === null ? "–" : t("perKg", { price: format.perKg(paise) });

  return (
    <DialogContent
      showCloseButton={false}
      className="max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl"
    >
      <DialogHeader className="pe-10">
        <DialogTitle className="text-xl font-semibold">{name}</DialogTitle>
        <DialogDescription>
          {t("detail.description", {
            code: row.code,
            family: t(`families.${row.family}`),
          })}
        </DialogDescription>
      </DialogHeader>
      <DialogClose asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="absolute end-2 top-2"
          aria-label={t("detail.close")}
        >
          <XIcon aria-hidden />
        </Button>
      </DialogClose>

      <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
        <Figure
          label={t("detail.today")}
          value={perKg(row.todayPaise)}
          extra={<PriceChange changePct={row.weekChangePct} />}
        />
        <Figure label={t("detail.low")} value={perKg(range?.low ?? null)} />
        <Figure label={t("detail.high")} value={perKg(range?.high ?? null)} />
        <Figure
          label={t("detail.floor")}
          value={
            row.floorPaise === null
              ? t("detail.noFloor")
              : perKg(row.floorPaise)
          }
        />
      </dl>

      {row.series.length > 0 ? (
        <PriceChart
          series={row.series}
          floorPaise={row.floorPaise}
          material={name}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("detail.noHistory")}</p>
      )}
    </DialogContent>
  );
}
