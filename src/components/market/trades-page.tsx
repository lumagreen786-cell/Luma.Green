"use client";

import { useQuery } from "convex/react";
import { ArrowLeftRightIcon, ShoppingCartIcon, TagIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useId, useState } from "react";

import {
  AppPageHeader,
  EmptyState,
  ListSkeleton,
} from "@/components/app/page-parts";
import { useListScroll } from "@/components/app/use-list-scroll";
import { useViewPreference } from "@/components/app/use-view-preference";
import type { OrgWorkspace } from "@/components/app/use-workspace";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { defaultLocale, isLocale, localeDirection } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { byUrgency, isAvailableTradeAction } from "./logic";
import { isRecycledPetFeedstock } from "./pet-procurement";
import { TradeCard } from "./trade-card";
import type { TradeView } from "./types";
import { useOrg } from "./use-org";

type Tab = "buying" | "selling";

/**
 * `/app/trades`: every trade, with where it stands and the next step as one
 * button. All approved businesses have both directions because eligible
 * manufacturer byproducts can return to any matching approved buyer.
 */
export function TradesPage({
  isRecycledPet = false,
}: {
  isRecycledPet?: boolean;
}) {
  const t = useTranslations("market");
  const org = useOrg();
  return (
    <>
      <AppPageHeader
        title={t("trades.title")}
        lead={t("trades.gatewayPending")}
        actions={
          org ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link
                  href={
                    isRecycledPet
                      ? "/app/trades"
                      : "/app/trades?procurement=pet"
                  }
                >
                  {t(isRecycledPet ? "browse.all" : "recycledPetProcurement")}
                </Link>
              </Button>
              {isRecycledPet ? (
                <Button asChild variant="outline">
                  <Link href="/app/market?procurement=pet">
                    {t("recycledPetProcurement")}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      {org ? (
        // The tab can come from the link (?tab=buying), which needs Suspense.
        <Suspense fallback={<ListSkeleton />}>
          <Trades org={org} isRecycledPet={isRecycledPet} />
        </Suspense>
      ) : (
        <EmptyState
          icon={ArrowLeftRightIcon}
          title={t("forBusinessesTitle")}
          body={t("forBusinessesBody")}
        />
      )}
    </>
  );
}

function Trades({
  org,
  isRecycledPet,
}: {
  org: OrgWorkspace;
  isRecycledPet: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("market");
  const trades = useQuery(api.market.trades);
  const asked = useSearchParams().get("tab");
  const [savedTab, saveTab] = useViewPreference(`trades.${org.id}`, "");
  const [chosen, setChosen] = useState<{
    tab: Tab;
    asked: string | null;
  } | null>(null);

  useListScroll(`trades.${org.id}`, trades !== undefined);
  if (trades === undefined) return <ListSkeleton />;

  const scopedTrades = isRecycledPet
    ? {
        buying: trades.buying.filter((trade) =>
          isRecycledPetFeedstock(trade.material.code),
        ),
        selling: trades.selling.filter((trade) =>
          isRecycledPetFeedstock(trade.material.code),
        ),
      }
    : trades;
  const waiting = {
    buying: scopedTrades.buying.filter((trade) =>
      trade.actions.some((action) => isAvailableTradeAction(action)),
    ).length,
    selling: scopedTrades.selling.filter((trade) =>
      trade.actions.some((action) => isAvailableTradeAction(action)),
    ).length,
  };

  const fallback: Tab =
    org.kind === "kabadiwala" || (waiting.selling > 0 && waiting.buying === 0)
      ? "selling"
      : "buying";
  const linked = asked === "buying" || asked === "selling" ? asked : null;
  const remembered =
    savedTab === "buying" || savedTab === "selling" ? savedTab : null;
  const tab =
    (chosen?.asked === asked ? chosen.tab : null) ??
    linked ??
    remembered ??
    fallback;
  return (
    <Tabs
      dir={localeDirection(isLocale(locale) ? locale : defaultLocale)}
      value={tab}
      onValueChange={(value) => {
        if (!(value === "buying" || value === "selling")) {
          return;
        }

        setChosen({ tab: value, asked });
        saveTab(value);
        const params = new URLSearchParams(window.location.search);
        params.set("tab", value);
        window.history.replaceState(null, "", `?${params.toString()}`);
      }}
      className="gap-4"
    >
      <TabsList
        aria-label={t("trades.tabsLabel")}
        className="w-full rounded-xl bg-card p-2"
      >
        {(["buying", "selling"] as const).map((value) => (
          <TabsTrigger key={value} value={value}>
            {t(`trades.${value}`)}
            {waiting[value] > 0 ? (
              <>
                <span
                  aria-hidden
                  className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums"
                >
                  {waiting[value]}
                </span>
                <span className="sr-only">
                  {t("trades.waitingBadge", { count: waiting[value] })}
                </span>
              </>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {(["buying", "selling"] as const).map((value) => (
        <TabsContent key={value} value={value}>
          <TradeList
            tab={value}
            trades={scopedTrades[value]}
            isRecycledPet={isRecycledPet}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TradeList({
  tab,
  trades,
  isRecycledPet,
}: {
  tab: Tab;
  trades: TradeView[];
  isRecycledPet: boolean;
}) {
  const t = useTranslations("market.trades");
  const headingId = useId();
  if (trades.length === 0) {
    const isBuying = tab === "buying";
    const marketHref = isRecycledPet
      ? "/app/market?procurement=pet"
      : "/app/market";
    return (
      <EmptyState
        icon={isBuying ? ShoppingCartIcon : TagIcon}
        title={t(isBuying ? "emptyBuyingTitle" : "emptySellingTitle")}
        body={t(isBuying ? "emptyBuyingBody" : "emptySellingBody")}
        action={
          <Button asChild size="lg" className="mt-2 h-11">
            <Link href={isBuying ? marketHref : "/app/sell"}>
              {t(isBuying ? "goBuy" : "goSell")}
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {t(tab)}
      </h2>
      <ul className="flex flex-col gap-3">
        {trades.toSorted(byUrgency).map((trade) => (
          <li key={trade.id}>
            <TradeCard
              trade={trade}
              side={tab === "buying" ? "buyer" : "seller"}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
