"use client";

import { useQuery } from "convex/react";
import { ArrowDownToLineIcon, PackageOpenIcon, ShieldIcon } from "lucide-react";
import { useState } from "react";

import {
  AppPageHeader,
  DemoNote,
  EmptyState,
  ListSkeleton,
} from "@/components/app/page-parts";
import { CityField } from "@/components/location/city-field";
import { cn } from "@/lib/utils";

import { api } from "../../../../convex/_generated/api";
import type { Family } from "../../../../convex/lib/catalogue";
import { canonicalCity } from "../../../../convex/lib/geography";
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
  const [input, setInput] = useState("");
  const city = canonicalCity(input);
  const rows = useQuery(api.adminPrices.list, city ? { city } : "skip");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
      <AppPageHeader
        title="Prices"
        lead="Select a city to manage its dated indicative prices."
      />
      <DemoNote>Sample prices for the prototype, not market rates.</DemoNote>
      <div className="grid min-w-0 items-start gap-8 border-t border-border pt-8 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-6 [&>div]:xl:grid-cols-1">
          <PriceRules />
          <CityField
            value={input}
            onChange={setInput}
            labels={{
              city: "City or locality",
              state: "State or union territory",
              choose: "Choose one",
              cityError:
                "Enter a city or locality using 2–60 letters and spaces.",
            }}
          />
        </aside>
        <div className="min-w-0 space-y-4">
          {city ? (
            <PriceGroups rows={rows} city={city} />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Choose a city to see its reference prices.
            </p>
          )}
        </div>
      </div>
      <div className="grid min-w-0 items-start gap-8 lg:grid-cols-2">
        <CatalogueSetup />
        <CatalogueNames />
        <div className="min-w-0 lg:col-span-2">
          <MaterialClassification />
        </div>
      </div>
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
    <ul className="grid gap-5 border-s-2 border-primary ps-4">
      {rules.map((rule) => (
        <li key={rule.title} className="flex gap-3">
          <rule.icon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-foreground"
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

function PriceGroups({
  rows,
  city,
}: {
  rows: readonly PriceRowData[] | undefined;
  city: string;
}) {
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
          className="min-w-0 border-b border-border pb-3"
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
              <PriceRow key={row.code} row={row} city={city} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
