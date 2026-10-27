"use client";

import { useQuery } from "convex/react";
import { ArrowDownToLineIcon, PackageOpenIcon, ShieldIcon } from "lucide-react";

import {
  AppPageHeader,
  DemoNote,
  EmptyState,
  ListSkeleton,
} from "@/components/app/page-parts";
import { cn } from "@/lib/utils";

import { api } from "../../../../convex/_generated/api";
import type { Family } from "../../../../convex/lib/catalogue";
import { PILOT_CITY } from "../../../../convex/lib/review";
import { FAMILY_LABELS } from "../labels";
import { CatalogueNames } from "./catalogue-names";
import { CatalogueSetup } from "./catalogue-setup";
import { MaterialClassification } from "./material-classification";
import { PRICE_COLUMNS, PriceRow, type PriceRowData } from "./price-row";

const FAMILY_ORDER = Object.keys(FAMILY_LABELS) as Family[];

/** Rows by family, in the catalogue's order within each. */
export function groupByFamily(
  rows: readonly PriceRowData[],
): { family: Family; rows: PriceRowData[] }[] {
  return FAMILY_ORDER.map((family) => ({
    family,
    rows: rows.filter((row) => row.family === family),
  })).filter((group) => group.rows.length > 0);
}

/** `/admin/prices`: the city's minimum and fallback price per material. */
export function PriceTables() {
  const rows = useQuery(api.adminPrices.list, { city: PILOT_CITY });
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
      <AppPageHeader
        title="Prices"
        lead={`The indicative reference prices per kilo in ${PILOT_CITY}, for every material.`}
      />
      <DemoNote>Sample prices for the prototype, not market rates.</DemoNote>
      <PriceRules />
      <PriceGroups rows={rows} />
      <CatalogueSetup />
      <CatalogueNames />
      <MaterialClassification />
    </div>
  );
}

function PriceRules() {
  const rules = [
    {
      icon: ShieldIcon,
      title: "Reference low",
      body: "A dated indication only. Each business sets its own offer. Reference changes do not change offers or agreed orders.",
    },
    {
      icon: ArrowDownToLineIcon,
      title: "Reference price",
      body: "Reference guidance for estimates. It does not replace a current business offer.",
    },
  ];
  return (
    <ul className="grid gap-4 border-b pb-5 sm:grid-cols-2 sm:gap-8">
      {rules.map((rule) => (
        <li key={rule.title} className="flex gap-3">
          <rule.icon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          <span className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium">{rule.title}</span>
            <span className="text-muted-foreground">{rule.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PriceGroups({ rows }: { rows: readonly PriceRowData[] | undefined }) {
  if (rows === undefined) return <ListSkeleton rows={4} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={PackageOpenIcon}
        title="No materials yet"
        body="Add the catalogue definitions below, then set approved prices. No sample rates or stock will be created."
      />
    );
  }
  return (
    <>
      {groupByFamily(rows).map(({ family, rows: members }) => (
        <section
          key={family}
          aria-labelledby={`family-${family}`}
          className="min-w-0 border-b"
        >
          <div className="flex items-baseline justify-between gap-2 border-b py-4">
            <h2 id={`family-${family}`} className="font-semibold">
              {FAMILY_LABELS[family]}
            </h2>
            <span className="text-xs text-muted-foreground">
              {members.length === 1
                ? "1 material"
                : `${String(members.length)} materials`}
            </span>
          </div>
          <div
            aria-hidden
            className={cn(
              "hidden gap-x-4 border-b py-2 text-xs font-medium text-muted-foreground xl:grid",
              PRICE_COLUMNS,
            )}
          >
            <span>Material</span>
            <span>Reference low ₹/kg</span>
            <span>Reference price ₹/kg</span>
            <span>Last changed</span>
            <span />
          </div>
          <div className="divide-y">
            {members.map((row) => (
              <PriceRow key={row.code} row={row} city={PILOT_CITY} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
