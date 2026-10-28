"use client";

import { useQuery } from "convex/react";
import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { useFormat } from "@/components/app/format";
import { DemoNote } from "@/components/app/page-parts";
import { CityField } from "@/components/location/city-field";
import { pickTeaser, type PriceRow } from "@/components/prices/board";
import { FAMILY_ICONS } from "@/components/prices/family-icon";
import { PriceChange } from "@/components/prices/price-change";
import { PricePlaceholder } from "@/components/prices/price-placeholder";
import { Sparkline } from "@/components/prices/sparkline";
import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Link } from "@/i18n/navigation";

import { api } from "../../../../convex/_generated/api";
import { canonicalCity } from "../../../../convex/lib/geography";
import { DataBoundary } from "../data-boundary";

/** Four everyday materials from today's board, beside the home page hero. */
export function PriceTeaser() {
  const [city, setCity] = useState("");
  const t = useTranslations("home.teaser");
  if (!isConvexConfigured) {
    return (
      <TeaserCard>
        <PricePlaceholder state="unavailable" compact />
      </TeaserCard>
    );
  }
  return (
    <div className="space-y-4">
      <CityField value={city} onChange={setCity} />
      <DataBoundary
        fallback={() => (
          <TeaserCard>
            <p className="text-muted-foreground">{t("error")}</p>
          </TeaserCard>
        )}
      >
        <LiveTeaser city={canonicalCity(city)} />
      </DataBoundary>
    </div>
  );
}

function LiveTeaser({ city }: { city: string | null }) {
  const t = useTranslations("home.teaser");
  const format = useFormat();
  const board = useQuery(api.catalogue.priceBoard, city ? { city } : "skip");
  if (!city)
    return (
      <TeaserCard>
        <PricePlaceholder state="empty" compact />
      </TeaserCard>
    );

  if (board === undefined) {
    return (
      <TeaserCard>
        <PricePlaceholder state="loading" compact />
      </TeaserCard>
    );
  }

  const rows = pickTeaser(board.rows);
  if (rows.length === 0) {
    return (
      <TeaserCard>
        <PricePlaceholder state="empty" compact />
      </TeaserCard>
    );
  }

  return (
    <TeaserCard
      meta={
        board.date
          ? t("placeAndDate", {
              city: board.city,
              date: format.date(board.date),
            })
          : t("place", { city: board.city })
      }
    >
      <ul className="-my-3 divide-y">
        {rows.map((row) => (
          <TeaserRow key={row.code} row={row} />
        ))}
      </ul>
      <DemoNote>{t("demoNote")}</DemoNote>
    </TeaserCard>
  );
}

function TeaserRow({ row }: { row: PriceRow }) {
  const prices = useTranslations("prices");
  const format = useFormat();
  const Icon = FAMILY_ICONS[row.family];
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center text-primary">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">
          {format.material(row.names, row.code)}
        </span>
        {row.floorPaise === null ? null : (
          <span className="text-xs text-muted-foreground">
            {prices("floor", { price: format.perKg(row.floorPaise) })}
          </span>
        )}
      </span>
      <Sparkline
        series={row.series}
        width={56}
        height={28}
        className="hidden min-[400px]:block"
      />
      <span className="flex flex-col items-end gap-1">
        {row.todayPaise === null ? null : (
          <span className="font-semibold tabular-nums">
            {prices("perKg", { price: format.perKg(row.todayPaise) })}
          </span>
        )}
        <PriceChange changePct={row.weekChangePct} />
      </span>
    </li>
  );
}

function TeaserCard({
  meta,
  children,
}: {
  meta?: string;
  children: ReactNode;
}) {
  const t = useTranslations("home.teaser");
  return (
    <div className="grid gap-4 py-1 lg:grid-cols-[1fr_2fr] lg:gap-x-12">
      <div className="flex flex-col items-start gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{meta ?? t("place")}</p>
      </div>
      {children}
      <Link
        href="/prices"
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 lg:col-start-2"
      >
        {t("seeAll")}
        <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
      </Link>
    </div>
  );
}
