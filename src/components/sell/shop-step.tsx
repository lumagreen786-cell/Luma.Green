"use client";

import { LoaderCircleIcon, LocateFixedIcon, StoreIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { EmptyState, ListSkeleton } from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { isLocale, localeMeta } from "@/i18n/locales";

import type { Mode } from "./draft";
import { ModeChoice } from "./mode-choice";
import { ShopOption } from "./shop-option";
import type { ShopOffer } from "./types";
import type { LocationState } from "./use-location";

/** Whether a shop can take this kind of booking. */
export function canServe(shop: ShopOffer, mode: Mode): boolean {
  return mode === "dropoff" || shop.offersPickup;
}

/** The best offer and the nearest shop among those that can serve. */
function highlights(shops: readonly ShopOffer[], mode: Mode) {
  const usable = shops.filter((shop) => canServe(shop, mode));
  const best = usable.reduce<ShopOffer | undefined>(
    (top, shop) =>
      shop.estimatePaise !== undefined &&
      (top === undefined || shop.estimatePaise > (top.estimatePaise ?? 0))
        ? shop
        : top,
    undefined,
  );
  const nearest = usable.reduce<ShopOffer | undefined>((top, shop) => {
    if (shop.distanceKm === undefined) return top;
    return top?.distanceKm === undefined || shop.distanceKm < top.distanceKm
      ? shop
      : top;
  }, undefined);
  return { bestId: best?.id, nearestId: nearest?.id };
}

function LocationControl({
  state,
  onLocate,
  onStop,
}: {
  state: LocationState;
  onLocate: () => void;
  onStop: () => void;
}) {
  const t = useTranslations("sell.shop");
  if (state.status === "on") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-primary">
          <LocateFixedIcon aria-hidden className="size-4" />
          {t("nearestFirst")}
        </span>
        <Button variant="link" className="h-11 px-0 text-sm" onClick={onStop}>
          {t("byPrice")}
        </Button>
      </div>
    );
  }
  const isLocating = state.status === "locating";
  return (
    <Button
      variant="outline"
      className="h-11 rounded-lg px-4"
      disabled={isLocating}
      onClick={onLocate}
    >
      {isLocating ? (
        <LoaderCircleIcon aria-hidden className="animate-spin" />
      ) : (
        <LocateFixedIcon aria-hidden />
      )}
      {t(isLocating ? "locating" : "useLocation")}
    </Button>
  );
}

/**
 * Step 2, "Who buys it?": pickup or drop-off, then the shops with what each
 * would pay for this basket — best offer first, or nearest first when the
 * household shares where they are.
 */
export function ShopStep({
  mode,
  shopId,
  shops,
  location,
  onMode,
  onShop,
  onLocate,
  onStopLocation,
}: {
  mode: Mode;
  shopId: string | undefined;
  shops: readonly ShopOffer[] | undefined;
  location: LocationState;
  onMode: (mode: Mode) => void;
  onShop: (shopId: string) => void;
  onLocate: () => void;
  onStopLocation: () => void;
}) {
  const t = useTranslations("sell.shop");
  const { bestId, nearestId } = highlights(shops ?? [], mode);
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-6">
      <ModeChoice mode={mode} onChange={onMode} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="shops-title" className="font-semibold">
            {t("listLabel")}
          </h3>
          <LocationControl
            state={location}
            onLocate={onLocate}
            onStop={onStopLocation}
          />
        </div>
        {location.status === "failed" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("locationFailed")}
          </p>
        ) : null}

        {shops === undefined ? <ListSkeleton rows={3} /> : null}
        {shops?.length === 0 ? (
          <EmptyState icon={StoreIcon} title={t("empty")} />
        ) : null}
        {shops && shops.length > 0 ? (
          <RadioGroup
            dir={localeMeta[isLocale(locale) ? locale : "en"].dir}
            aria-labelledby="shops-title"
            value={shopId ?? ""}
            onValueChange={onShop}
            className="gap-3"
          >
            {shops.map((shop) => (
              <ShopOption
                key={shop.id}
                shop={shop}
                isSelected={shop.id === shopId}
                isDisabled={!canServe(shop, mode)}
                isBest={shop.id === bestId && shops.length > 1}
                isNearest={shop.id === nearestId}
              />
            ))}
          </RadioGroup>
        ) : null}
      </div>
    </div>
  );
}
