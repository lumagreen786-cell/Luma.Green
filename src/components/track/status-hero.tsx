"use client";

import {
  BanIcon,
  CircleCheckBigIcon,
  CircleXIcon,
  HourglassIcon,
  type LucideIcon,
  PartyPopperIcon,
  TruckIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { cn } from "@/lib/utils";

import type { BookingStatus } from "../../../convex/lib/chain";
import { receiptStatusKey } from "./receipt-sharing";
import { progressIndex, progressSteps } from "./status";
import type { TrackedBooking } from "./types";

const HERO: Record<BookingStatus, { icon: LucideIcon; tone: string }> = {
  requested: {
    icon: HourglassIcon,
    tone: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  },
  accepted: {
    icon: CircleCheckBigIcon,
    tone: "bg-accent text-accent-foreground",
  },
  on_the_way: {
    icon: TruckIcon,
    tone: "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  },
  completed: {
    icon: PartyPopperIcon,
    tone: "bg-accent text-accent-foreground",
  },
  declined: { icon: CircleXIcon, tone: "bg-destructive/10 text-destructive" },
  cancelled: { icon: BanIcon, tone: "bg-muted text-muted-foreground" },
};

function Progress({ booking }: { booking: TrackedBooking }) {
  const t = useTranslations("track.progress");
  const current = progressIndex(booking.status, booking.mode);
  if (current === null) return null;
  const steps = progressSteps(booking.mode);
  return (
    <ol
      aria-label={t("label")}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${String(steps.length)}, 1fr)` }}
    >
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          className="flex flex-col gap-1.5"
        >
          <span
            aria-hidden
            className={cn(
              "h-1 rounded-sm",
              index <= current ? "bg-primary" : "bg-border",
            )}
          />
          <span
            className={cn(
              "text-xs",
              index === current
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {t(step)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The top of the tracking page: what's happening now in one sentence, what
 * it means, and how far along it is. Updates live as the shop answers.
 */
export function StatusHero({ booking }: { booking: TrackedBooking }) {
  const t = useTranslations("track");
  const tReview = useTranslations("track.review");
  const format = useFormat();
  const { icon: Icon, tone } = HERO[booking.status];
  const shop = booking.shop.name;
  const paid = format.money(booking.receipt?.totalPaise ?? 0);

  return (
    <section
      aria-labelledby="track-title"
      className="flex flex-col gap-5 border-b border-border pb-5"
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            tone,
          )}
        >
          <Icon aria-hidden className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col gap-1" role="status">
          <p className="font-mono text-xs text-muted-foreground">
            {t("reference", { token: booking.token })}
          </p>
          <h1
            id="track-title"
            className="font-display text-2xl leading-tight font-semibold tracking-tight text-balance wrap-anywhere sm:text-3xl"
          >
            {booking.status === "completed"
              ? tReview("title")
              : t(`hero.${booking.status}`, {
                  shop,
                  mode: booking.mode,
                  amount: paid,
                })}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {booking.status === "completed"
              ? tReview(receiptStatusKey(booking.receiptReview))
              : t(`hero.${booking.status}Body`)}
          </p>
        </div>
      </div>
      <Progress booking={booking} />
    </section>
  );
}
