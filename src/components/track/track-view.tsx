"use client";

import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { indiaToday } from "../../../convex/lib/onboarding";
import { HouseholdScheduleControls } from "../collection/operations-controls";
import { useNow } from "../sell/states";
import { ItemsCard, MoneySection, WhenCard } from "./booking-cards";
import { CancelBooking } from "./cancel-booking";
import { NextActions } from "./next-actions";
import { CollectionSharing, ReceiptReview } from "./receipt-sharing";
import { ShopCard } from "./shop-card";
import { StatusHero } from "./status-hero";
import { Timeline } from "./timeline";
import type { TrackedBooking } from "./types";

/**
 * Everything about one booking, in the order a household asks: what's
 * happening, when, with whom, what's collected, and what they get.
 */
export function TrackView({ booking }: { booking: TrackedBooking }) {
  const t = useTranslations("track");
  const today = indiaToday(useNow());

  return (
    <div className="flex flex-col gap-5">
      <StatusHero booking={booking} />
      <WhenCard booking={booking} today={today} />
      {booking.failedVisitReason ? (
        <p role="status" className="border-s-2 border-border ps-4 text-sm">
          {booking.failedVisitReason}
        </p>
      ) : null}
      {booking.dispatch && booking.dispatch.attempt > 1 ? (
        <p
          role="status"
          className="border-s-2 border-primary py-2 ps-4 text-sm text-accent-foreground"
        >
          {t("dispatchChanged")}
        </p>
      ) : null}
      <ShopCard shop={booking.shop} />
      {booking.isMine ? <MoneySection booking={booking} /> : null}
      <ReceiptReview booking={booking} />
      <ItemsCard booking={booking} />
      <Timeline timeline={booking.timeline} />
      <CancelBooking booking={booking} />
      {booking.isMine ? <HouseholdScheduleControls /> : null}
      <NextActions booking={booking} />
      <CollectionSharing
        token={booking.token}
        owner={booking.isMine}
        open={!["completed", "cancelled", "declined"].includes(booking.status)}
      />
      <p className="flex justify-center gap-2 text-center text-sm text-muted-foreground">
        <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t("saved")}
      </p>
    </div>
  );
}
