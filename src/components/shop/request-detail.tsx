"use client";

import { useQuery } from "convex/react";
import {
  ChevronLeftIcon,
  InfoIcon,
  LockIcon,
  type LucideIcon,
  MapPinIcon,
  NavigationIcon,
  PhoneIcon,
  SearchXIcon,
  StoreIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect } from "react";

import { useFormat } from "@/components/app/format";
import {
  DemoNote,
  EmptyState,
  ListSkeleton,
} from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { type BookingStatus, kgToGrams } from "../../../convex/lib/chain";
import { formatIndianMobile } from "../../../convex/lib/phone";
import { BookingStatusPill, SlotLabel } from "./booking-parts";
import { BookingPhotos } from "./booking-photos";
import { NotForShop, QueryBoundary } from "./guards";
import { MaterialIcon } from "./material-icon";
import { effectivePaise } from "./prices";
import { ReceiptView } from "./receipt-view";
import { AcceptDecline, StartTripButton } from "./request-actions";
import type { BookingDetail, BookingView } from "./types";
import { useIndiaToday, useShop } from "./use-shop";
import { WeighAndPay } from "./weigh-and-pay";

/** Statuses in which the shop has accepted and may see who and where. */
const REVEALED = new Set<BookingStatus>([
  "accepted",
  "on_the_way",
  "completed",
]);

/** `/app/requests/[id]`: one request, what to do next, and its history. */
export function RequestDetail({ id }: { id: string }) {
  const t = useTranslations("shop");
  const shop = useShop();
  if (shop === null) return <NotForShop title={t("requests.title")} />;
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/app/requests"
        className="inline-flex min-h-11 w-fit items-center gap-1 rounded-md text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
        {t("request.back")}
      </Link>
      {shop ? (
        <QueryBoundary>
          <RequestBody id={id} />
        </QueryBoundary>
      ) : (
        <ListSkeleton />
      )}
    </div>
  );
}

function RequestBody({ id }: { id: string }) {
  const t = useTranslations("shop");
  const detail = useQuery(api.shop.get, { bookingId: id });
  const isLoaded = detail !== undefined;

  // Arriving from "Weigh and pay" on a card: jump to the scale once loaded.
  useEffect(() => {
    if (isLoaded && window.location.hash === "#weigh") {
      document.querySelector("#weigh")?.scrollIntoView({ block: "start" });
    }
  }, [isLoaded]);

  if (detail === undefined) return <ListSkeleton rows={4} />;
  if (detail === null) {
    return (
      <>
        <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
          {t("requests.title")}
        </h1>
        <EmptyState
          icon={SearchXIcon}
          title={t("request.notFoundTitle")}
          body={t("request.notFoundBody")}
        />
      </>
    );
  }
  return <RequestView detail={detail} />;
}

function RequestView({ detail }: { detail: BookingDetail }) {
  const t = useTranslations("shop");
  const today = useIndiaToday();
  const { booking, points, timeline } = detail;
  const isRevealed = REVEALED.has(booking.status);
  const canWeigh =
    booking.status === "accepted" || booking.status === "on_the_way";
  const canStartTrip =
    booking.status === "accepted" && booking.mode === "pickup";

  return (
    <>
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
            {booking.name ?? t("household")}
          </h1>
          <BookingStatusPill status={booking.status} />
        </div>
        <p className="text-muted-foreground">
          <SlotLabel
            date={booking.slotDate}
            window={booking.slotWindow}
            today={today}
          />
        </p>
      </header>

      {booking.receipt ? (
        <ReceiptView
          receipt={booking.receipt}
          points={points}
          name={booking.name}
        />
      ) : null}

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-6">
          <BookingFacts
            booking={booking}
            rates={detail.rates}
            isRevealed={isRevealed}
          />
          <BookingPhotos bookingId={booking.id} />
        </div>
        <div className="min-w-0 space-y-6">
          {booking.status === "requested" ? (
            <AcceptDecline bookingId={booking.id} />
          ) : null}
          {canStartTrip ? (
            <StartTripButton
              bookingId={booking.id}
              className="h-12 w-full text-base"
            />
          ) : null}
          {canWeigh ? (
            <WeighSection booking={booking} rates={detail.rates} />
          ) : null}
          <ClosedNote status={booking.status} />
        </div>
      </div>
      <details className="border-t py-4">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">
          {t("request.history")}
        </summary>
        <History timeline={timeline} />
      </details>
      <DemoNote>{t("sampleNote")}</DemoNote>
    </>
  );
}

/** The scale, with the shop's prices for anything it might add. */
function WeighSection({
  booking,
  rates,
}: {
  booking: BookingView;
  rates: BookingDetail["rates"];
}) {
  const card = useQuery(api.shop.rateCard);
  const prices = new Map<string, number>();
  const rows = card?.rows ?? [];
  for (const row of rows) {
    const paise = effectivePaise(row);
    if (paise !== null) prices.set(row.material.code, paise);
  }
  for (const rate of rates) prices.set(rate.materialCode, rate.paisePerKg);
  return (
    <WeighAndPay
      bookingId={booking.id}
      items={booking.items}
      rates={prices}
      choices={rows
        .filter((row) => prices.has(row.material.code))
        .map((row) => row.material)}
    />
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium break-words">{children}</p>
      </div>
    </div>
  );
}

/** Where, who, and what: the address and phone only once accepted. */
function BookingFacts({
  booking,
  rates,
  isRevealed,
}: {
  booking: BookingView;
  rates: BookingDetail["rates"];
  isRevealed: boolean;
}) {
  const t = useTranslations("shop");
  const tSimple = useTranslations("sell.simple");
  const format = useFormat();
  const address = booking.mode === "pickup" ? booking.address : undefined;
  const rateOf = new Map(rates.map((rate) => [rate.materialCode, rate]));
  return (
    <section
      aria-labelledby="facts-title"
      className="flex flex-col gap-4 border-y border-border py-4"
    >
      <h2 id="facts-title" className="sr-only">
        {t("request.details")}
      </h2>
      <div className="flex flex-col gap-4">
        <Fact
          icon={address ? MapPinIcon : StoreIcon}
          label={t("request.where")}
        >
          {address ?? t("dropoff")}
        </Fact>
        <Fact icon={PhoneIcon} label={t("request.phone")}>
          <span dir="ltr">
            {isRevealed ? formatIndianMobile(booking.phone) : booking.phone}
          </span>
        </Fact>
      </div>
      {isRevealed ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 text-base"
          >
            <a href={`tel:${booking.phone}`}>
              <PhoneIcon aria-hidden className="size-5" />
              {t("request.call")}
            </a>
          </Button>
          {address ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 text-base"
            >
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
              >
                <NavigationIcon aria-hidden className="size-5" />
                {t("request.directions")}
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="flex items-start gap-2 border-s-2 border-border ps-3 text-sm text-muted-foreground">
          <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("request.hidden")}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t pt-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t("request.items")}
        </h3>
        <ul className="flex flex-col gap-3">
          {booking.items.map((item, index) => {
            const rate = rateOf.get(item.material.code);
            return (
              <li
                key={`${item.material.code}-${String(index)}`}
                className="flex items-center gap-3"
              >
                <MaterialIcon family={item.material.family} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {format.material(item.material.names, item.material.code)}
                  </span>
                  {rate ? (
                    <span className="text-sm text-muted-foreground">
                      {t("perKg", { price: format.perKg(rate.paisePerKg) })}
                    </span>
                  ) : null}
                </div>
                <span className="text-lg font-semibold tabular-nums">
                  {format.weight(kgToGrams(item.estKg))}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-baseline justify-between gap-3 border-t pt-3">
          <span className="text-sm text-muted-foreground">
            {t("request.estimate")}
          </span>
          <span className="text-xl font-semibold tabular-nums">
            {booking.estimatePaise === undefined
              ? tSimple("estimateLater")
              : t("about", { amount: format.money(booking.estimatePaise) })}
          </span>
        </div>
      </div>
    </section>
  );
}

function ClosedNote({ status }: { status: BookingStatus }) {
  const t = useTranslations("shop.request");
  if (status !== "declined" && status !== "cancelled") return null;
  return (
    <p className="flex items-start gap-2 border-s-2 border-border ps-4 text-muted-foreground">
      <InfoIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
      {t(status)}
    </p>
  );
}

function History({ timeline }: { timeline: BookingDetail["timeline"] }) {
  const t = useTranslations("shop");
  const format = useFormat();
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="text-lg font-semibold">
        {t("request.history")}
      </h2>
      <ol className="flex flex-col gap-3">
        {timeline.map((step) => (
          <li key={`${step.status}-${String(step.at)}`} className="flex gap-3">
            <span
              aria-hidden
              className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary"
            />
            <div className="flex flex-col">
              <span className="font-medium">
                {t(`request.steps.${step.status}`)}
              </span>
              <span className="text-sm text-muted-foreground">
                {format.dateTime(step.at)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
