"use client";

import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRightIcon, StoreIcon, TruckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/components/app/format";
import { StatusPill } from "@/components/app/page-parts";
import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { indiaToday } from "../../../convex/lib/onboarding";
import { statusTone } from "../track/status";
import { useTimeFormat } from "./time";

type MyBooking = NonNullable<
  FunctionReturnType<typeof api.households.mine>
>[number];

const SHOWN_AT_FIRST = 3;

/**
 * "Your bookings" at the top of /sell, for a household that has confirmed
 * their number before: each one links to its tracking page.
 */
export function MyBookings({ showEmpty = false }: { showEmpty?: boolean }) {
  return isConvexConfigured ? <LiveMyBookings showEmpty={showEmpty} /> : null;
}

function LiveMyBookings({ showEmpty }: { showEmpty: boolean }) {
  const household = useTranslations("householdTools");
  const number = useFormatter();
  const t = useTranslations("sell.mine");
  const { isAuthenticated } = useConvexAuth();
  const bookings = useQuery(api.households.mine, isAuthenticated ? {} : "skip");
  const [isExpanded, setExpanded] = useState(false);

  if (bookings === undefined)
    return showEmpty ? <p role="status">{household("loading")}</p> : null;
  if (!bookings || bookings.length === 0)
    return showEmpty ? (
      <p className="rounded-[1.75rem] bg-card p-6 text-sm text-card-foreground text-muted-foreground">
        {household("noBookings")}
      </p>
    ) : null;
  const shown = isExpanded ? bookings : bookings.slice(0, SHOWN_AT_FIRST);

  return (
    <section
      aria-labelledby="my-bookings-title"
      className="flex min-w-0 flex-col gap-3 rounded-[1.75rem] bg-card p-5 text-card-foreground sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="my-bookings-title" className="text-lg font-medium">
          {t("title")}
        </h2>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm tabular-nums">
          {number.number(bookings.length)}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {shown.map((booking) => (
          <li key={booking.token}>
            <BookingRow booking={booking} />
          </li>
        ))}
      </ul>
      {bookings.length > SHOWN_AT_FIRST ? (
        <Button
          variant="ghost"
          className="self-start"
          aria-expanded={isExpanded}
          onClick={() => {
            setExpanded((value) => !value);
          }}
        >
          {isExpanded
            ? t("showFewer")
            : t("showAll", { count: bookings.length })}
        </Button>
      ) : null}
    </section>
  );
}

function BookingRow({ booking }: { booking: MyBooking }) {
  const t = useTranslations("sell");
  const tStatus = useTranslations("track.status");
  const format = useFormat();
  const time = useTimeFormat();
  const estimateLabel =
    booking.estimatePaise === undefined
      ? t("simple.estimateLater")
      : t("mine.estimate", { amount: format.money(booking.estimatePaise) });
  const ModeIcon = booking.mode === "pickup" ? TruckIcon : StoreIcon;
  const day = time.day(booking.slotDate, indiaToday(), {
    today: t("when.today"),
    tomorrow: t("when.tomorrow"),
  });

  return (
    <Link
      href={`/t/${booking.token}`}
      className="flex items-center gap-3 rounded-xl px-2 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <ModeIcon aria-hidden className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-words">{booking.shopName}</span>
          <StatusPill tone={statusTone(booking.status)}>
            {tStatus(booking.status)}
          </StatusPill>
        </span>
        <span className="text-sm text-muted-foreground">
          {day} · {t(`windows.${booking.slotWindow}`)}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {booking.paidPaise === undefined
            ? estimateLabel
            : t("mine.paid", { amount: format.money(booking.paidPaise) })}
          {booking.itemCount > 0 ? " · " : null}
          {booking.itemCount > 0
            ? t("mine.summary", {
                items: booking.itemCount,
                weight: format.weight(booking.estGrams),
              })
            : null}
        </span>
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
      />
    </Link>
  );
}
