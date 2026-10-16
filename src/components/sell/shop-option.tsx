"use client";

import { BadgeCheckIcon, ClockIcon, MapPinIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { StatusPill } from "@/components/app/page-parts";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import { useTimeFormat } from "./time";
import type { ShopOffer } from "./types";

/** One shop in the "Who buys it?" list, with its offer for the basket. */
export function ShopOption({
  shop,
  isSelected,
  isDisabled,
  isBest,
  isNearest,
}: {
  shop: ShopOffer;
  isSelected: boolean;
  /** A pickup was asked for and this shop doesn't pick up. */
  isDisabled: boolean;
  isBest: boolean;
  isNearest: boolean;
}) {
  const tSimple = useTranslations("sell.simple");
  const t = useTranslations("sell.shop");
  const format = useFormat();
  const time = useTimeFormat();
  const id = `shop-${shop.id}`;
  const hours = time.hours(shop.hours);

  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 border-b px-2 py-4 font-normal transition-colors duration-150 motion-reduce:transition-none",
        isSelected ? "border-primary bg-accent/50" : "border-border",
        isDisabled
          ? "cursor-not-allowed bg-muted/50"
          : "cursor-pointer hover:border-primary/50",
      )}
    >
      <RadioGroupItem
        id={id}
        value={shop.id}
        disabled={isDisabled}
        className="mt-1 size-5"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-wrap items-start justify-between gap-3">
          <span className="text-base leading-snug font-semibold">
            {shop.name}
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="text-xl leading-tight font-semibold tracking-tight text-foreground tabular-nums">
              {shop.estimatePaise === undefined
                ? tSimple("estimateLater")
                : format.money(shop.estimatePaise)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("offerFor")}
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPinIcon aria-hidden className="size-4 shrink-0" />
            {shop.area}
            {shop.distanceKm === undefined ? null : (
              <span className="tabular-nums">
                {" · "}
                {t("distance", { km: format.number(shop.distanceKm, 1) })}
              </span>
            )}
          </span>
          {hours ? (
            <span className="flex items-center gap-1">
              <ClockIcon aria-hidden className="size-4 shrink-0" />
              {t("hours", { hours })}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap gap-1.5 pt-0.5">
          {isBest ? <StatusPill tone="good">{t("best")}</StatusPill> : null}
          {isNearest ? (
            <StatusPill tone="info">{t("nearest")}</StatusPill>
          ) : null}
          <StatusPill tone={shop.offersPickup ? "good" : "neutral"}>
            {t(shop.offersPickup ? "picksUp" : "dropOnly")}
          </StatusPill>
          <StatusPill tone="neutral">
            <BadgeCheckIcon aria-hidden className="me-1 size-3.5" />
            {t("verified")}
          </StatusPill>
        </span>
        {shop.fallbackCodes.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("cityPrice", { count: shop.fallbackCodes.length })}
          </span>
        ) : null}
        {isDisabled ? (
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {t("noPickupHere")}
          </span>
        ) : null}
      </span>
    </Label>
  );
}
