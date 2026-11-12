"use client";

import {
  ArrowRightIcon,
  ChevronRightIcon,
  HandCoinsIcon,
  InboxIcon,
  type LucideIcon,
  PackageIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useFormat } from "@/components/app/format";
import { StatCard } from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { SlotLabel } from "./booking-parts";
import { areaOf, firstName, splitDue } from "./bookings";
import { requestHref } from "./request-cards";
import type { BookingView, Payouts, Stock } from "./types";

/** The home screen's cards: what's waiting, what's due, what's been paid. */

function BigCount({
  count,
  isHot,
}: {
  count: number | undefined;
  isHot: boolean;
}) {
  const format = useFormat();
  if (count === undefined) return <Skeleton className="h-8 w-12" />;
  return (
    <p
      className={cn(
        "text-3xl font-semibold tracking-tight tabular-nums",
        isHot && "text-foreground",
      )}
    >
      {format.number(count)}
    </p>
  );
}

function CardShell({
  id,
  title,
  icon: Icon,
  count,
  isHot = false,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  count: number | undefined;
  isHot?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6",
        isHot && "border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="text-sm font-medium text-muted-foreground">
            {title}
          </h2>
          <BigCount count={count} isHot={isHot} />
        </div>
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
      </div>
      {children}
    </section>
  );
}

/** How many households are waiting for an answer, and the way to them. */
export function NewRequestsCard({ count }: { count: number | undefined }) {
  const t = useTranslations("shop.home");
  const navigation = useTranslations("app.nav");
  const hasNew = count !== undefined && count > 0;
  return (
    <CardShell
      id="home-new"
      title={t("newTitle")}
      icon={InboxIcon}
      count={count}
      isHot={hasNew}
    >
      {count === undefined ? (
        <Skeleton className="h-6 w-48" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {hasNew ? t("newSome", { count }) : t("newNone")}
        </p>
      )}
      <Button
        asChild
        size="lg"
        variant={hasNew ? "default" : "outline"}
        className="mt-auto min-h-11 self-start text-sm"
      >
        <Link
          href="/app/requests"
          aria-label={`${navigation("requests")}: ${t("seeRequests")}`}
        >
          {navigation("requests")}
          <ArrowRightIcon aria-hidden className="size-5 rtl:rotate-180" />
        </Link>
      </Button>
    </CardShell>
  );
}

/** Pickups due today (or late), and the next one: when and where. */
export function TodayCard({
  active,
  today,
  city,
}: {
  active: readonly BookingView[] | undefined;
  today: string;
  city: string;
}) {
  const t = useTranslations("shop");
  const due = active ? splitDue(active, today).due : undefined;
  const next = due?.[0];
  return (
    <CardShell
      id="home-today"
      title={t("home.todayTitle")}
      icon={TruckIcon}
      count={due?.length}
    >
      {due === undefined ? <Skeleton className="h-20 rounded-none" /> : null}
      {next ? (
        <Link
          href={requestHref(next.id)}
          className="flex items-center gap-3 border-s-2 border-primary py-2 ps-4 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("home.next")}
            </span>
            <span className="truncate font-semibold">
              {firstName(next.name) ?? t("household")}
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {next.mode === "pickup" && next.address
                ? areaOf(next.address, city)
                : t("dropoff")}
            </span>
            <span className="text-sm font-medium">
              <SlotLabel
                date={next.slotDate}
                window={next.slotWindow}
                today={today}
              />
            </span>
          </div>
          <ChevronRightIcon
            aria-hidden
            className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
          />
        </Link>
      ) : null}
      {due?.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("home.todayNone")}</p>
      ) : null}
      <Button
        asChild
        size="lg"
        variant="outline"
        className="mt-auto min-h-11 self-start text-sm"
      >
        <Link
          href={{ pathname: "/app/requests", query: { tab: "today" } }}
          aria-label={`${t("days.today")}: ${t("home.seeToday")}`}
        >
          {t("days.today")}
        </Link>
      </Button>
    </CardShell>
  );
}

/** Paid out today and this week, and what the stock is worth. */
export function MoneyStats({
  payouts,
  stock,
}: {
  payouts: Payouts | undefined;
  stock: Stock | undefined;
}) {
  const t = useTranslations("shop.home");
  const stockCopy = useTranslations("shop.stock");
  const format = useFormat();
  const tile = "h-28 rounded-2xl";
  return (
    <section aria-labelledby="home-money">
      <h2 id="home-money" className="sr-only">
        {t("moneyTitle")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {payouts ? (
          <StatCard
            label={t("paidToday")}
            value={format.money(payouts.todayPaise)}
            hint={t("pickups", { count: payouts.todayCount })}
            icon={WalletIcon}
          />
        ) : (
          <Skeleton className={tile} />
        )}
        {payouts ? (
          <StatCard
            label={t("paidWeek")}
            value={format.money(payouts.weekPaise)}
            hint={t("pickups", { count: payouts.weekCount })}
            icon={HandCoinsIcon}
          />
        ) : (
          <Skeleton className={tile} />
        )}
        <Link
          href="/app/stock"
          className="rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:col-span-2 lg:col-span-1"
        >
          {stock ? (
            <StatCard
              label={t("stockWorth")}
              value={
                stock.totalValuePaise === null
                  ? "—"
                  : format.money(stock.totalValuePaise)
              }
              hint={
                stock.totalValuePaise === null
                  ? stockCopy("noPrice")
                  : t("stockWeight", {
                      weight: format.weight(stock.totalGrams),
                    })
              }
              icon={PackageIcon}
              tone="good"
            />
          ) : (
            <Skeleton className={tile} />
          )}
        </Link>
      </div>
    </section>
  );
}
