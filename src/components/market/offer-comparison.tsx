"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";

import { deliveredPrice } from "../../../convex/lib/marketRanking";
import type { ListingView } from "./types";

/** Declared comparison inputs are separate from the material checkout amount. */
export function OfferComparison({
  listing,
}: {
  listing: Pick<
    ListingView,
    "askPaisePerKg" | "freightPaisePerKg" | "distanceKm" | "deliveryAvailableAt"
  >;
}) {
  const t = useTranslations("marketComparison"),
    logistics = useTranslations("logistics");
  const format = useFormat(),
    dates = useFormatter();
  const delivered = deliveredPrice(listing);
  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p>
        {listing.freightPaisePerKg === undefined
          ? t("quote")
          : t("freight", { price: format.perKg(listing.freightPaisePerKg) })}
      </p>
      {delivered === null ? null : (
        <p>{t("delivered", { price: format.perKg(delivered) })}</p>
      )}
      {listing.distanceKm === undefined ? null : (
        <p>
          {logistics("distance", {
            value: dates.number(Math.round(listing.distanceKm * 1000)),
          })}
        </p>
      )}
      {listing.deliveryAvailableAt === undefined ? null : (
        <p>
          {t("available", {
            date: dates.dateTime(listing.deliveryAvailableAt, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      )}
      <p>{t("notice")}</p>
    </div>
  );
}
