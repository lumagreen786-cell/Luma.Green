"use client";

import { useQuery } from "convex/react";
import {
  ChevronRightIcon,
  IndianRupeeIcon,
  type LucideIcon,
  TagIcon,
} from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { DemoNote } from "@/components/app/page-parts";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import {
  CollectionAvailabilityControls,
  CollectionVisitControls,
  EmployerPaymentControls,
} from "../collection/operations-controls";
import { DispatchSettings } from "./dispatch-settings";
import { QueryBoundary } from "./guards";
import { MoneyStats, NewRequestsCard, TodayCard } from "./home-cards";
import { PriceCheck } from "./price-check";
import { useIndiaToday, useShop } from "./use-shop";

/**
 * `/app` for a kabadiwala: what's waiting, what's due today, what's been paid,
 * and how the shop's prices sit against the market. Big numbers, few words.
 */
export function KabadiwalaHome() {
  const t = useTranslations("shop");
  const shop = useShop();
  if (!shop) return null;
  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
        <Greeting name={shop.name} />
      </div>
      <QueryBoundary>
        <HomeBody city={shop.city} />
        <DispatchSettings />
        <CollectionAvailabilityControls />
        <CollectionVisitControls />
        <EmployerPaymentControls />
      </QueryBoundary>
      <QuickLinks />
      <DemoNote>{t("sampleNote")}</DemoNote>
    </div>
  );
}

function Greeting({ name }: { name: string }) {
  const t = useTranslations("shop.home");
  const format = useFormatter();
  const now = useNow();
  return (
    <header className="flex flex-col gap-2 border-b border-border pb-5">
      <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
        {name}
      </h1>
      <p className="text-sm font-medium text-primary">{t("greeting")}</p>
      <p className="text-sm text-muted-foreground">
        {format.dateTime(now, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
    </header>
  );
}

function HomeBody({ city }: { city: string }) {
  const requests = useQuery(api.shop.requests);
  const payouts = useQuery(api.shop.payouts);
  const stock = useQuery(api.stock.mine);
  const card = useQuery(api.shop.rateCard);
  const today = useIndiaToday();
  return (
    <>
      <div className="grid gap-2 md:grid-cols-2 md:gap-6">
        <NewRequestsCard count={requests?.new.length} />
        <TodayCard active={requests?.active} today={today} city={city} />
      </div>
      <MoneyStats payouts={payouts} stock={stock} />
      <PriceCheck card={card} stock={stock} />
    </>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 border-b border-border py-3 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center text-primary">
        <Icon aria-hidden className="size-6" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
      />
    </Link>
  );
}

function QuickLinks() {
  const t = useTranslations("shop.home");
  return (
    <nav
      aria-label={t("quickLinks")}
      className="flex flex-col border-t border-border"
    >
      <QuickLink
        href="/app/sell"
        icon={TagIcon}
        title={t("sell")}
        hint={t("sellHint")}
      />
      <QuickLink
        href="/app/prices"
        icon={IndianRupeeIcon}
        title={t("prices")}
        hint={t("pricesHint")}
      />
    </nav>
  );
}
