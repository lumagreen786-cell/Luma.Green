"use client";

import {
  BadgeCheckIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  StoreIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useTimeFormat } from "../sell/time";
import type { TrackedBooking } from "./types";

/** Who the booking is with: the shop, where it is, and a way to call. */
export function ShopCard({ shop }: { shop: TrackedBooking["shop"] }) {
  const t = useTranslations("track.shop");
  const time = useTimeFormat();
  const hours = time.hours(shop.hours);

  return (
    <section
      aria-labelledby="shop-title"
      className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4"
    >
      <h2 id="shop-title" className="text-sm text-muted-foreground">
        {t("title")}
      </h2>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <StoreIcon aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-lg leading-snug font-semibold">{shop.name}</p>
          <p className="flex items-center gap-1 text-sm font-medium text-primary">
            <BadgeCheckIcon aria-hidden className="size-4" />
            {t("verified")}
          </p>
        </div>
        {shop.phone ? (
          <Button asChild variant="outline" className="h-12 shrink-0 px-4">
            <a
              href={`tel:${shop.phone}`}
              aria-label={t("callLabel", { shop: shop.name })}
            >
              <PhoneIcon aria-hidden />
              {t("call")}
            </a>
          </Button>
        ) : null}
      </div>
      <p className="flex gap-2 text-sm">
        <MapPinIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <span>
          <span className="font-medium">{shop.area}</span>
          <br />
          <span className="text-muted-foreground">{shop.address}</span>
        </span>
      </p>
      {hours ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClockIcon aria-hidden className="size-4 shrink-0" />
          {t("hours", { hours })}
        </p>
      ) : null}
    </section>
  );
}
