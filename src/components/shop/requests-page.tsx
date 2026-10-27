"use client";

import { useQuery } from "convex/react";
import { CircleCheckBigIcon, InboxIcon, TruckIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, Suspense } from "react";

import {
  AppPageHeader,
  DemoNote,
  EmptyState,
  ListSkeleton,
} from "@/components/app/page-parts";
import { useListScroll } from "@/components/app/use-list-scroll";
import { useViewPreference } from "@/components/app/use-view-preference";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { defaultLocale, isLocale, localeDirection } from "@/i18n/locales";

import { api } from "../../../convex/_generated/api";
import { splitDue } from "./bookings";
import { NotForShop, QueryBoundary } from "./guards";
import {
  ActiveRequestCard,
  DoneRequestCard,
  NewRequestCard,
} from "./request-cards";
import type { BookingView, Requests } from "./types";
import { useIndiaToday, useShop } from "./use-shop";

const TABS = ["new", "today", "done"] as const;
type Tab = (typeof TABS)[number];

function tabFrom(value: string | null): Tab {
  return TABS.find((tab) => tab === value) ?? "new";
}

/** `/app/requests`: New, Today and Done, each a list of cards. */
export function RequestsPage() {
  const t = useTranslations("shop");
  const shop = useShop();
  if (shop === null) return <NotForShop title={t("requests.title")} />;
  return (
    <div className="flex flex-col gap-6">
      <AppPageHeader title={t("requests.title")} lead={t("requests.lead")} />
      {shop ? (
        <QueryBoundary>
          {/* The tab lives in the address (?tab=today), read on the client. */}
          <Suspense fallback={<ListSkeleton />}>
            <RequestTabs city={shop.city} scope={shop.id} />
          </Suspense>
        </QueryBoundary>
      ) : (
        <ListSkeleton />
      )}
      <DemoNote>{t("sampleNote")}</DemoNote>
    </div>
  );
}

function RequestTabs({ city, scope }: { city: string; scope: string }) {
  const locale = useLocale();
  const t = useTranslations("shop.requests");
  const requests = useQuery(api.shop.requests);
  const today = useIndiaToday();
  const requested = useSearchParams().get("tab");
  const [saved, saveTab] = useViewPreference(`requests.${scope}`, "new");
  const tab = tabFrom(requested ?? saved);
  useListScroll(`requests.${scope}.${tab}`, requests !== undefined);

  // Next keeps useSearchParams in step with history.replaceState, so the tab
  // switches without a server request. Pass null: reusing Next internal
  // history state bypasses its search-parameter update.
  const showTab = (next: string) => {
    const params = new URLSearchParams(window.location.search);
    const chosen = tabFrom(next);
    saveTab(chosen);
    if (chosen === "new") params.delete("tab");
    else params.set("tab", chosen);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query === "" ? window.location.pathname : `?${query}`,
    );
  };

  return (
    <Tabs
      dir={localeDirection(isLocale(locale) ? locale : defaultLocale)}
      value={tab}
      onValueChange={showTab}
      className="gap-4"
    >
      <TabsList variant="line" className="w-full">
        {TABS.map((value) => (
          <TabsTrigger key={value} value={value} className="gap-2">
            {t(`tabs.${value}`)}
            <TabCount count={countFor(requests, value)} />
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="new">
        <h2 className="sr-only">{t("tabs.new")}</h2>
        {requests ? (
          <CardList
            bookings={requests.new}
            empty={
              <EmptyState
                icon={InboxIcon}
                title={t("empty.newTitle")}
                body={t("empty.newBody")}
              />
            }
            card={(booking) => (
              <NewRequestCard booking={booking} today={today} city={city} />
            )}
          />
        ) : (
          <ListSkeleton />
        )}
      </TabsContent>
      <TabsContent value="today">
        {requests ? (
          <TodayList bookings={requests.active} today={today} city={city} />
        ) : (
          <ListSkeleton />
        )}
      </TabsContent>
      <TabsContent value="done">
        <h2 className="sr-only">{t("tabs.done")}</h2>
        {requests ? (
          <CardList
            bookings={requests.done}
            empty={
              <EmptyState
                icon={CircleCheckBigIcon}
                title={t("empty.doneTitle")}
                body={t("empty.doneBody")}
              />
            }
            card={(booking) => <DoneRequestCard booking={booking} />}
          />
        ) : (
          <ListSkeleton />
        )}
      </TabsContent>
    </Tabs>
  );
}

/** A badge with what's waiting: new requests and pickups to do. */
function countFor(requests: Requests | undefined, tab: Tab): number {
  if (!requests || tab === "done") return 0;
  return tab === "new" ? requests.new.length : requests.active.length;
}

function TabCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="min-w-5 rounded-full bg-primary px-1.5 text-xs leading-5 font-semibold text-primary-foreground tabular-nums">
      {count}
    </span>
  );
}

function CardList({
  bookings,
  empty,
  card,
}: {
  bookings: readonly BookingView[];
  empty: ReactNode;
  card: (booking: BookingView) => ReactNode;
}) {
  if (bookings.length === 0) return <>{empty}</>;
  return (
    <ul className="flex flex-col">
      {bookings.map((booking) => (
        <li key={booking.id}>{card(booking)}</li>
      ))}
    </ul>
  );
}

/** Pickups under way: due now first, then those still ahead. */
function TodayList({
  bookings,
  today,
  city,
}: {
  bookings: readonly BookingView[];
  today: string;
  city: string;
}) {
  const t = useTranslations("shop.requests");
  if (bookings.length === 0) {
    return (
      <>
        <h2 className="sr-only">{t("tabs.today")}</h2>
        <EmptyState
          icon={TruckIcon}
          title={t("empty.todayTitle")}
          body={t("empty.todayBody")}
        />
      </>
    );
  }
  const { due, later } = splitDue(bookings, today);
  const card = (booking: BookingView) => (
    <ActiveRequestCard booking={booking} today={today} city={city} />
  );
  return (
    <div className="flex flex-col gap-6">
      {[
        { key: "due", title: t("dueNow"), list: due },
        { key: "later", title: t("later"), list: later },
      ]
        .filter((group) => group.list.length > 0)
        .map((group) => (
          <section key={group.key} className="flex flex-col">
            <h2 className="text-base font-semibold text-muted-foreground">
              {group.title}
            </h2>
            <CardList bookings={group.list} empty={null} card={card} />
          </section>
        ))}
    </div>
  );
}
