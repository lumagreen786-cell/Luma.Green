"use client";

import { CalendarDaysIcon, StoreIcon, TruckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { DemoNote } from "@/components/app/page-parts";

import { kgToGrams, pointsFor } from "../../../convex/lib/chain";
import { FamilyIcon } from "../sell/family";
import { MoneyCard } from "../sell/money-card";
import { useTimeFormat } from "../sell/time";
import type { TrackedBooking } from "./types";

/** When the pickup or drop-off is, and which of the two it is. */
export function WhenCard({
  booking,
  today,
}: {
  booking: TrackedBooking;
  today: string;
}) {
  const t = useTranslations("track");
  const tWindows = useTranslations("sell.windows");
  const time = useTimeFormat();
  const ModeIcon = booking.mode === "pickup" ? TruckIcon : StoreIcon;
  return (
    <section
      aria-labelledby="when-title"
      className="flex flex-col gap-3 border-b border-border pb-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <CalendarDaysIcon aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col">
          <h2 id="when-title" className="text-sm text-muted-foreground">
            {t("when")}
          </h2>
          <p className="text-lg font-semibold">
            {t("whenValue", {
              day: time.day(booking.slotDate, today, {
                today: t("today"),
                tomorrow: t("tomorrow"),
              }),
              window: tWindows(booking.slotWindow),
              time: time.window(booking.slotWindow),
            })}
          </p>
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ModeIcon aria-hidden className="size-4 text-primary" />
        {t(`mode.${booking.mode}`)}
      </p>
    </section>
  );
}

/** What's being collected: the estimate, or what was weighed once paid. */
export function ItemsCard({ booking }: { booking: TrackedBooking }) {
  const t = useTranslations("track.items");
  const tSell = useTranslations("sell");
  const format = useFormat();
  const receipt = booking.receipt;

  return (
    <section
      aria-labelledby="items-title"
      className="flex flex-col border-y border-border"
    >
      <h2 id="items-title" className="pt-4 text-lg font-semibold">
        {t("title")}
      </h2>
      <ul className="divide-y">
        {receipt
          ? receipt.lines.map((line) => (
              <li
                key={line.material.code}
                className="flex items-center gap-3 py-3"
              >
                <FamilyIcon family={line.material.family} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {format.material(line.material.names, line.material.code)}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {t("weighed", {
                      weight: format.weight(line.grams),
                      price: format.perKg(line.paisePerKg),
                    })}
                  </span>
                </div>
                <span className="font-semibold tabular-nums">
                  {format.money(line.paise)}
                </span>
              </li>
            ))
          : booking.items.map((item) => (
              <li
                key={item.material.code}
                className="flex items-center gap-3 py-3"
              >
                <FamilyIcon family={item.material.family} size="sm" />
                <span className="min-w-0 flex-1 font-medium">
                  {format.material(item.material.names, item.material.code)}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {t("estimated", {
                    weight: format.weight(kgToGrams(item.estKg)),
                  })}
                </span>
              </li>
            ))}
      </ul>
      {receipt ? null : (
        <p className="pb-4 text-sm text-muted-foreground">
          {tSell("basket.weighNote")}
        </p>
      )}
    </section>
  );
}

/** The money and points: expected until it's weighed, then what was paid. */
export function MoneySection({ booking }: { booking: TrackedBooking }) {
  const t = useTranslations("track.money");
  const tSell = useTranslations("sell");
  const format = useFormat();

  if (booking.status === "declined" || booking.status === "cancelled") {
    return null;
  }
  const receipt = booking.receipt;

  return (
    <section aria-labelledby="money-title" className="flex flex-col gap-2">
      <h2 id="money-title" className="sr-only">
        {t("title")}
      </h2>
      {receipt ? (
        <MoneyCard
          amount={t("paid", { amount: format.money(receipt.totalPaise) })}
          points={
            booking.points === undefined
              ? undefined
              : t("points", { points: booking.points })
          }
          note={
            <>
              {t("paidBy", {
                method: receipt.method,
                date: format.dateTime(receipt.paidAt),
              })}
              <br />
              {booking.estimatePaise === undefined
                ? null
                : t("estimateWas", {
                    amount: format.money(booking.estimatePaise),
                  })}
            </>
          }
        />
      ) : (
        <MoneyCard
          amount={
            booking.estimatePaise === undefined
              ? tSell("simple.estimateLater")
              : t("estimate", {
                  amount: format.money(booking.estimatePaise),
                })
          }
          points={
            booking.estimatePaise === undefined
              ? undefined
              : t("pointsAfter", {
                  points: pointsFor(booking.estimatePaise),
                })
          }
          note={t("estimateNote")}
        />
      )}
      <DemoNote>{tSell("demoNote")}</DemoNote>
    </section>
  );
}
