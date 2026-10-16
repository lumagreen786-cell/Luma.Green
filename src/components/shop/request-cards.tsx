"use client";

import { BanIcon, CircleCheckBigIcon, ScaleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import {
  BookingStatusPill,
  ItemChips,
  PlaceLine,
  SlotLabel,
} from "./booking-parts";
import { firstName } from "./bookings";
import { AcceptDecline, StartTripButton } from "./request-actions";
import type { BookingView } from "./types";

/** The three kinds of card on /app/requests: new, under way, finished. */

export function requestHref(id: string, anchor?: string): string {
  return anchor ? `/app/requests/${id}#${anchor}` : `/app/requests/${id}`;
}

/** The household's first name, linking to the request. */
function CardName({ booking }: { booking: BookingView }) {
  const t = useTranslations("shop");
  const name = firstName(booking.name) ?? "";
  return (
    <h3 id={`request-${booking.id}`} className="text-lg font-semibold">
      <Link
        href={requestHref(booking.id)}
        className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {name === "" ? t("household") : name}
      </Link>
    </h3>
  );
}

interface CardProps {
  booking: BookingView;
  today: string;
  city: string;
}

export function NewRequestCard({ booking, today, city }: CardProps) {
  const t = useTranslations("shop");
  const tSimple = useTranslations("sell.simple");
  const format = useFormat();
  return (
    <article
      aria-labelledby={`request-${booking.id}`}
      className="flex flex-col gap-3 border-b border-border py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <CardName booking={booking} />
          <PlaceLine booking={booking} city={city} />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          <SlotLabel
            date={booking.slotDate}
            window={booking.slotWindow}
            today={today}
          />
        </span>
      </div>
      <ItemChips items={booking.items} />
      <div className="flex items-baseline justify-between gap-2 border-t pt-3">
        <span className="text-sm text-muted-foreground">
          {t("requests.estimate")}
        </span>
        <span className="text-xl font-semibold tabular-nums">
          {booking.estimatePaise === undefined
            ? tSimple("estimateLater")
            : t("about", { amount: format.money(booking.estimatePaise) })}
        </span>
      </div>
      <AcceptDecline bookingId={booking.id} />
    </article>
  );
}

export function ActiveRequestCard({ booking, today, city }: CardProps) {
  const t = useTranslations("shop");
  const canStartTrip =
    booking.status === "accepted" && booking.mode === "pickup";
  return (
    <article
      aria-labelledby={`request-${booking.id}`}
      className="flex flex-col gap-3 border-b border-border py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <CardName booking={booking} />
          <p className="text-sm font-medium">
            <SlotLabel
              date={booking.slotDate}
              window={booking.slotWindow}
              today={today}
            />
          </p>
        </div>
        <BookingStatusPill status={booking.status} />
      </div>
      <PlaceLine booking={booking} city={city} />
      <ItemChips items={booking.items} />
      <div className={cn("grid gap-3", canStartTrip && "sm:grid-cols-2")}>
        {canStartTrip ? <StartTripButton bookingId={booking.id} /> : null}
        <Button asChild size="lg" className="h-12 text-base">
          <Link href={requestHref(booking.id, "weigh")}>
            <ScaleIcon aria-hidden className="size-5" />
            {t("requests.weigh")}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function DoneRequestCard({ booking }: { booking: BookingView }) {
  const t = useTranslations("shop");
  const format = useFormat();
  const formatter = useFormatter();
  const { receipt } = booking;
  const materials = formatter.list(
    booking.items.map((item) =>
      format.material(item.material.names, item.material.code),
    ),
  );
  return (
    <article
      aria-labelledby={`request-${booking.id}`}
      className="flex flex-wrap items-center gap-3 border-b border-border py-4"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg",
          receipt
            ? "bg-accent text-accent-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {receipt ? (
          <CircleCheckBigIcon className="size-5" />
        ) : (
          <BanIcon className="size-5" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <CardName booking={booking} />
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {t("requests.doneLine", {
            when: receipt
              ? format.dateTime(receipt.paidAt)
              : format.date(booking.slotDate),
            materials,
          })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {receipt ? (
          <span className="text-lg font-semibold tabular-nums">
            {format.money(receipt.totalPaise)}
          </span>
        ) : null}
        <BookingStatusPill status={booking.status} />
      </div>
    </article>
  );
}
