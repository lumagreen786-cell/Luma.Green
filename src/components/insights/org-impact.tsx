"use client";

import {
  HandCoinsIcon,
  HouseIcon,
  IndianRupeeIcon,
  LeafIcon,
  type LucideIcon,
  RecycleIcon,
  ShoppingCartIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import {
  DemoNote,
  EmptyState,
  Section,
  StatCard,
} from "@/components/app/page-parts";
import { cn } from "@/lib/utils";

import { BarList } from "./bar-list";
import { FAMILY_ICONS } from "./families";
import { LedgerExplainer } from "./ledger-explainer";
import type { OrgImpact } from "./types";

interface Kpi {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "good";
}

/** The headline numbers, chosen by what each kind of business does. */
function useKpis(impact: OrgImpact): Kpi[] {
  const t = useTranslations("impact.kpi");
  const impactText = useTranslations("impact");
  const format = useFormat();
  const isFactory = impact.orgKind === "manufacturer";

  const recycled: Kpi = {
    key: "recycled",
    label: t(isFactory ? "recycledContent" : "recycled"),
    value: format.weight(impact.recycledGrams),
    hint: isFactory
      ? t("purchases", { count: impact.bought.count })
      : t("recycledHint"),
    icon: RecycleIcon,
    tone: "good",
  };
  const co2e: Kpi = {
    key: "co2e",
    label: t("co2e"),
    value:
      impact.co2eKg === null
        ? "—"
        : format.weight(Math.round(impact.co2eKg * 1000)),
    hint:
      impact.co2eKg === null ? impactText("factorUnavailable") : t("co2eHint"),
    icon: LeafIcon,
    tone: "good",
  };
  const earned: Kpi = {
    key: "earned",
    label: t("earned"),
    value: format.money(impact.sold.paise),
    hint: t("sales", { count: impact.sold.count }),
    icon: IndianRupeeIcon,
  };
  const spent: Kpi = {
    key: "spent",
    label: t("spent"),
    value: format.money(impact.bought.paise),
    hint: t("purchases", { count: impact.bought.count }),
    icon: WalletIcon,
  };
  const paid: Kpi = {
    key: "paid",
    label: t("paidHouseholds"),
    value: format.money(impact.households.paise),
    hint: t("pickups", { count: impact.households.count }),
    icon: HandCoinsIcon,
  };

  switch (impact.orgKind) {
    case "kabadiwala": {
      return [recycled, co2e, paid, earned];
    }
    case "yard":
    case "recycler": {
      return [recycled, co2e, earned, spent];
    }
    case "manufacturer": {
      return [recycled, co2e, spent];
    }
  }
}

function ByFamily({ impact }: { impact: OrgImpact }) {
  const t = useTranslations("impact");
  const format = useFormat();
  return (
    <Section title={t("byFamily.title")}>
      <p className="-mt-1 text-sm text-muted-foreground">
        {t("byFamily.lead")}
      </p>
      <BarList
        label={t("byFamily.title")}
        rows={impact.families.map((row) => ({
          key: row.family,
          label: t(`families.${row.family}`),
          icon: FAMILY_ICONS[row.family],
          value: row.grams,
          display: format.weight(row.grams),
          detail:
            row.co2eKg === null
              ? t("factorUnavailable")
              : t("byFamily.co2e", {
                  amount: format.weight(Math.round(row.co2eKg * 1000)),
                }),
        }))}
      />
    </Section>
  );
}

/** Came in, moved on: the ledger's two sides, in kilos and rupees. */
function Flows({ impact }: { impact: OrgImpact }) {
  const t = useTranslations("impact");
  const format = useFormat();
  const rows = [
    impact.orgKind === "kabadiwala" && {
      key: "households",
      icon: HouseIcon,
      flow: impact.households,
      count: t("kpi.pickups", { count: impact.households.count }),
    },
    impact.orgKind !== "kabadiwala" && {
      key: "bought",
      icon: ShoppingCartIcon,
      flow: impact.bought,
      count: t("kpi.purchases", { count: impact.bought.count }),
    },
    impact.orgKind !== "manufacturer" && {
      key: "sold",
      icon: TruckIcon,
      flow: impact.sold,
      count: t("kpi.sales", { count: impact.sold.count }),
    },
  ].filter((row) => row !== false);

  return (
    <Section title={t("flows.title")}>
      <p className="-mt-1 text-sm text-muted-foreground">{t("flows.lead")}</p>
      <ul className="flex flex-col gap-3">
        {rows.map(({ key, icon: Icon, flow, count }) => (
          <li
            key={key}
            className="flex items-center gap-3 border-b border-border py-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icon aria-hidden className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="font-medium">{t(`flows.${key}`)}</p>
              <p className="text-sm text-muted-foreground">{count}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <p className="font-semibold tabular-nums">
                {format.weight(flow.grams)}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {format.money(flow.paise)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** A business's impact: kilos kept in the loop, CO2e avoided, money moved. */
export function OrgImpactView({ impact }: { impact: OrgImpact }) {
  const t = useTranslations("impact");
  const format = useFormat();
  const kpis = useKpis(impact);

  if (impact.since === null) {
    return (
      <>
        <EmptyState
          icon={LeafIcon}
          title={t("empty.title")}
          body={t("empty.body")}
        />
        <LedgerExplainer />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "grid grid-cols-2 gap-4",
            kpis.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          {kpis.map(({ key, ...kpi }) => (
            <StatCard key={key} {...kpi} />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("since", { date: format.date(impact.since) })}
        </p>
      </div>

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 space-y-6">
          {impact.families.length > 0 ? <ByFamily impact={impact} /> : null}
          <LedgerExplainer />
        </div>
        <Flows impact={impact} />
      </div>
      <DemoNote>{t("demoNote")}</DemoNote>
    </>
  );
}
