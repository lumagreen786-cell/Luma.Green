"use client";

import { useQuery } from "convex/react";
import {
  CalendarDaysIcon,
  CircleAlertIcon,
  FactoryIcon,
  InfoIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/components/app/format";
import { DemoNote, EmptyState } from "@/components/app/page-parts";
import { CityField } from "@/components/location/city-field";
import { isConvexConfigured } from "@/components/providers/convex-provider";
import { DataBoundary } from "@/components/site/data-boundary";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

import { api } from "../../../convex/_generated/api";
import { canonicalCity } from "../../../convex/lib/geography";
import { groupBoard, type PriceBoardData, type PriceRow } from "./board";
import { FAMILY_ICONS } from "./family-icon";
import { PriceDetail } from "./price-detail";
import { PricePlaceholder } from "./price-placeholder";
import { BoardColumns, PriceRowButton } from "./price-row";

/**
 * The public price board for the selected city: live from Convex, grouped by family,
 * with recycled material in its own factory-gate section.
 */
export function PriceBoard() {
  const [city, setCity] = useState("");
  const t = useTranslations("prices");
  if (!isConvexConfigured) {
    return <PricePlaceholder state="unavailable" />;
  }
  return (
    <div className="space-y-6">
      <CityField value={city} onChange={setCity} />
      <DataBoundary
        fallback={(retry) => (
          <EmptyState
            icon={CircleAlertIcon}
            title={t("error.title")}
            body={t("error.body")}
            action={
              <Button variant="outline" className="mt-2 h-11" onClick={retry}>
                {t("error.retry")}
              </Button>
            }
          />
        )}
      >
        <LiveBoard city={canonicalCity(city)} />
      </DataBoundary>
    </div>
  );
}

function LiveBoard({ city }: { city: string | null }) {
  const board = useQuery(api.catalogue.priceBoard, city ? { city } : "skip");
  if (!city) return <PricePlaceholder state="empty" />;

  if (board === undefined) return <PricePlaceholder state="loading" />;
  const hasPrices = board.rows.some(
    (row) => row.todayPaise !== null || row.series.length > 0,
  );
  return hasPrices ? (
    <BoardView board={board} />
  ) : (
    <PricePlaceholder state="empty" />
  );
}

/** The board itself, given its data. */
export function BoardView({ board }: { board: PriceBoardData }) {
  const t = useTranslations("prices");
  const format = useFormat();
  const [openCode, setOpenCode] = useState<string | null>(null);
  const { scrap, recycled } = groupBoard(board.rows);
  const selected = board.rows.find((row) => row.code === openCode);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          {board.date ? (
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CalendarDaysIcon aria-hidden className="size-4 text-primary" />
              {t("date", { date: format.date(board.date) })}
            </p>
          ) : null}
          <p className="flex items-start gap-2">
            <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("floorHelp")}
          </p>
        </div>
        <DemoNote>{t("demoNote")}</DemoNote>
      </div>

      {scrap.map((group) => (
        <RowsSection
          key={group.family}
          id={`prices-${group.family}`}
          title={t(`families.${group.family}`)}
          icon={FAMILY_ICONS[group.family]}
          rows={group.rows}
          onOpen={setOpenCode}
        />
      ))}

      {recycled.length > 0 ? (
        <RowsSection
          id="prices-factory-gate"
          title={t("factoryGate.title")}
          intro={t("factoryGate.body")}
          icon={FactoryIcon}
          rows={recycled}
          onOpen={setOpenCode}
        />
      ) : null}

      <Dialog
        open={selected !== undefined}
        onOpenChange={(open) => {
          if (!open) setOpenCode(null);
        }}
      >
        {selected ? <PriceDetail row={selected} /> : null}
      </Dialog>
    </div>
  );
}

function RowsSection({
  id,
  title,
  intro,
  icon: Icon,
  rows,
  onOpen,
}: {
  id: string;
  title: string;
  intro?: string;
  icon: LucideIcon;
  rows: PriceRow[];
  onOpen: (code: string) => void;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2
          id={id}
          className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-accent-foreground">
            <Icon aria-hidden className="size-5" />
          </span>
          {title}
        </h2>
        {intro ? <p className="text-muted-foreground">{intro}</p> : null}
      </div>
      <div className="overflow-hidden border-y border-border">
        <BoardColumns />
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.code}>
              <PriceRowButton row={row} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
