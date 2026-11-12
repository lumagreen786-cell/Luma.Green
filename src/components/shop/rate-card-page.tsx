"use client";

import { useQuery } from "convex/react";
import { IndianRupeeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AppPageHeader,
  DemoNote,
  EmptyState,
  ListSkeleton,
} from "@/components/app/page-parts";

import { api } from "../../../convex/_generated/api";
import { NotForShop, QueryBoundary } from "./guards";
import { MaterialIcon } from "./material-icon";
import { RateRow } from "./rate-row";
import type { RateCard } from "./types";
import { useShop } from "./use-shop";

/**
 * `/app/prices`: what the shop pays households per kg, material by material,
 * never below the admin's minimum — docs/product/pricing.md.
 */
export function RateCardPage() {
  const t = useTranslations("shop");
  const shop = useShop();
  if (shop === null) return <NotForShop title={t("prices.title")} />;
  return (
    <div className="flex flex-col gap-6">
      <AppPageHeader title={t("prices.title")} lead={t("prices.lead")} />
      {shop ? (
        <QueryBoundary>
          <RateCardBody />
        </QueryBoundary>
      ) : (
        <ListSkeleton />
      )}
      <DemoNote>{t("sampleNote")}</DemoNote>
    </div>
  );
}

function RateCardBody() {
  const t = useTranslations("shop");
  const card = useQuery(api.shop.rateCard);
  if (card === undefined) return <ListSkeleton rows={6} />;
  if (card.rows.length === 0) {
    return (
      <EmptyState
        icon={IndianRupeeIcon}
        title={t("prices.emptyTitle")}
        body={t("prices.emptyBody")}
      />
    );
  }
  return (
    <>
      {byFamily(card.rows).map(({ family, rows }) => (
        <section
          key={family}
          aria-labelledby={`family-${family}`}
          className="grid min-w-0 items-start gap-4 rounded-panel bg-card p-4 text-card-foreground sm:p-5 xl:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <h2
            id={`family-${family}`}
            className="flex min-w-0 items-center gap-2 text-lg font-semibold xl:sticky xl:top-24"
          >
            <MaterialIcon family={family} size="sm" />
            {t(`families.${family}`)}
          </h2>
          <ul className="flex min-w-0 flex-col xl:border-s xl:ps-5">
            {rows.map((row) => (
              <RateRow key={row.material.code} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

type Row = RateCard["rows"][number];

/** Rows grouped by family, in the order the rate card lists them. */
function byFamily(rows: readonly Row[]) {
  const groups: { family: Row["material"]["family"]; rows: Row[] }[] = [];
  for (const row of rows) {
    const group = groups.find((entry) => entry.family === row.material.family);
    if (group) group.rows.push(row);
    else groups.push({ family: row.material.family, rows: [row] });
  }
  return groups;
}
