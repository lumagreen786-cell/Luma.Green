"use client";

import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { indiaToday } from "../../../convex/lib/onboarding";
import { HouseholdScheduleControls } from "../collection/operations-controls";
import { useNow } from "../sell/states";
import { ItemsCard, MoneySection, WhenCard } from "./booking-cards";
import { CancelBooking } from "./cancel-booking";
import { FamilyCollectionControl } from "./family-collection-control";
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

  if (booking.familyView)
    return (
      <div className="flex flex-col gap-4">
        <StatusHero booking={booking} />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-card p-5">
            <WhenCard booking={booking} today={today} />
          </div>
          <div className="space-y-4 rounded-2xl bg-card p-5">
            <ShopCard shop={booking.shop} />
            <Timeline timeline={booking.timeline} />
          </div>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <StatusHero booking={booking} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-card p-5 sm:p-6">
            <NextActions booking={booking} />
            <WhenCard booking={booking} today={today} />
          </div>
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
          {booking.isMine ? <MoneySection booking={booking} /> : null}
          <ReceiptReview booking={booking} />
          <ItemsCard booking={booking} />
        </div>
        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl bg-card p-5 sm:p-6">
            <ShopCard shop={booking.shop} />
            <Timeline timeline={booking.timeline} />
          </div>
          <div className="space-y-4 rounded-2xl bg-card p-5 sm:p-6">
            <CancelBooking booking={booking} />
            {booking.isMine ? <HouseholdScheduleControls /> : null}
            <CollectionSharing
              token={booking.token}
              owner={booking.isMine}
              open={
                !["completed", "cancelled", "declined"].includes(booking.status)
              }
            />
            {booking.isMine && booking.sharedWithFamily !== undefined ? (
              <FamilyCollectionControl
                token={booking.token}
                shared={booking.sharedWithFamily}
              />
            ) : null}
          </div>
        </aside>
      </div>
      <p className="flex justify-center gap-2 text-center text-sm text-muted-foreground">
        <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t("saved")}
      </p>
    </div>
  );
}
