"use client";

import { RecycleIcon, StoreIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";

import { bookableDates, isWindowOpen } from "../../../convex/lib/households";
import { indiaToday } from "../../../convex/lib/onboarding";
import { EMPTY_DRAFT, type SellDraft } from "../sell/draft";
import { saveSellDraft } from "../sell/use-draft";
import type { TrackedBooking } from "./types";

/**
 * A declined request restarts the photo-first flow. The tracking projection
 * has no household contact details or private photos to copy.
 */
export function NextActions({ booking }: { booking: TrackedBooking }) {
  const t = useTranslations("track");
  const router = useRouter();

  if (booking.status === "declined") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("retryDetails")}</p>
        <Button
          size="lg"
          className="h-12 text-base"
          onClick={() => {
            saveSellDraft(retryBookingDraft(booking, Date.now()));
            router.push("/sell");
          }}
        >
          <StoreIcon aria-hidden />
          {t("tryAnother")}
        </Button>
      </div>
    );
  }

  const isDone =
    booking.status === "completed" || booking.status === "cancelled";
  return (
    <Button
      asChild
      size="lg"
      variant={isDone ? "default" : "outline"}
      className="h-12 text-base"
    >
      <Link href="/sell">
        <RecycleIcon aria-hidden />
        {t("sellMore")}
      </Link>
    </Button>
  );
}

/** Only public, current schedule choices can cross into a new request. */
export function retryBookingDraft(
  booking: Pick<TrackedBooking, "mode" | "slotDate" | "slotWindow">,
  now: number,
): SellDraft {
  const today = indiaToday(now);
  const canKeepSlot =
    bookableDates(today).includes(booking.slotDate) &&
    isWindowOpen(booking.slotDate, booking.slotWindow, today, now);
  return {
    ...EMPTY_DRAFT,
    mode: booking.mode,
    ...(canKeepSlot && {
      slotDate: booking.slotDate,
      slotWindow: booking.slotWindow,
    }),
  };
}
