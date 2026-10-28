"use client";

import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../../../convex/_generated/api";
import { canonicalCity } from "../../../convex/lib/geography";
import {
  isBookableDate,
  isWindowOpen,
  SLOT_WINDOWS,
} from "../../../convex/lib/households";
import { indiaToday } from "../../../convex/lib/onboarding";
import {
  addItem,
  EMPTY_DRAFT,
  hasItem,
  reachableStep,
  removeItem,
  sanitizeItems,
  type SellDraft,
  type SellStep,
  setKg,
} from "./draft";
import { FAMILY_STYLE } from "./family";
import { canServe } from "./shop-step";
import { useNow } from "./states";
import type { Material, PriceMap, ShopOffer } from "./types";
import { useSellDraft } from "./use-draft";
import { useLocation } from "./use-location";
import { useStepNavigation } from "./use-step-navigation";

/** Drops a chosen day or time that can no longer be booked. */
export function withFreshSlot(
  draft: SellDraft,
  today: string,
  now: number,
): SellDraft {
  const { slotDate, slotWindow } = draft;
  const isDayOpen =
    slotDate !== undefined &&
    isBookableDate(slotDate, today) &&
    SLOT_WINDOWS.some((window) => isWindowOpen(slotDate, window, today, now));
  const isWindowStillOpen =
    isDayOpen &&
    slotWindow !== undefined &&
    isWindowOpen(slotDate, slotWindow, today, now);
  return {
    ...draft,
    slotDate: isDayOpen ? slotDate : undefined,
    slotWindow: isWindowStillOpen ? slotWindow : undefined,
  };
}

/** Household estimates use the city's fallback, never the market quote or floor. */
function usePrices(city: string | null): PriceMap | undefined {
  const board = useQuery(
    api.catalogue.priceQuotes,
    city ? { city, source: "fallback" } : "skip",
  );
  return useMemo(() => {
    if (!board) return;
    const prices = new Map<string, number>();
    for (const row of board.rows) {
      const price = row.paisePerKg;
      if (price !== null) prices.set(row.code, price);
    }
    return prices;
  }, [board]);
}

/**
 * The shops for the explicit locality while a step needs them. Never keep
 * offers from an earlier city while a new city query is loading.
 */
function useShops(
  isNeeded: boolean,
  items: SellDraft["items"],
  near: { lat: number; lng: number } | undefined,
  city: string | null,
): ShopOffer[] | undefined {
  return useQuery(
    api.households.shops,
    isNeeded && city ? { city, items, ...(near && { near }) } : "skip",
  );
}

/**
 * Everything /sell knows right now: the stored draft checked against the
 * catalogue, the shops and the clock; the step to show; and the ways to
 * change them.
 */
export function useSellState() {
  const [stored, update] = useSellDraft();
  const materials = useQuery(api.catalogue.materials);
  const prices = usePrices(canonicalCity(stored?.city));
  const location = useLocation();
  const { wanted, goTo, replace } = useStepNavigation();
  const now = useNow();
  const today = indiaToday(now);
  const [hasMoved, setHasMoved] = useState(false);
  const [hasTriedWhen, setHasTriedWhen] = useState(false);

  const scrap = useMemo<Material[]>(
    () => (materials ?? []).filter((material) => material.stage === "scrap"),
    [materials],
  );
  const draft = stored ?? EMPTY_DRAFT;
  const items = useMemo(
    () => sanitizeItems(draft.items, new Set(scrap.map((m) => m.code))),
    [draft.items, scrap],
  );
  const shops = useShops(
    wanted !== "basket" && items.length > 0,
    items,
    location.point,
    canonicalCity(draft.city),
  );
  const shop = shops?.find((candidate) => candidate.id === draft.shopId);
  // While the list loads, trust the stored choice; once it's here, the shop
  // must still be listed and able to take this kind of booking.
  const isShopUsable =
    shops === undefined
      ? draft.shopId !== undefined
      : shop !== undefined && canServe(shop, draft.mode);

  const checked: SellDraft = {
    ...withFreshSlot(draft, today, now),
    items,
    shopId: isShopUsable ? draft.shopId : undefined,
  };
  const isLoaded = stored !== undefined && materials !== undefined;
  const step = reachableStep(wanted, checked);

  // Asked for a step whose earlier answers are missing: show the first
  // unanswered one, and make the address say so.
  useEffect(() => {
    if (isLoaded && step !== wanted) replace(step);
  }, [isLoaded, step, wanted, replace]);

  return {
    isLoaded,
    step,
    draft: checked,
    items,
    scrap,
    prices,
    shops,
    shop: isShopUsable ? shop : undefined,
    location,
    today,
    now,
    hasMoved,
    hasTriedWhen,
    moveTo: (next: SellStep) => {
      setHasMoved(true);
      goTo(next);
    },
    tryWhen: () => {
      setHasTriedWhen(true);
    },
    change: (patch: Partial<SellDraft>) => {
      update((current) => ({ ...current, ...patch }));
    },
    toggle: (material: Material) => {
      update((current) =>
        hasItem(current, material.code)
          ? removeItem(current, material.code)
          : addItem(
              current,
              material.code,
              FAMILY_STYLE[material.family].defaultKg,
            ),
      );
    },
    setItemKg: (code: string, kg: number) => {
      update((current) => setKg(current, code, kg));
    },
    dropItem: (code: string) => {
      update((current) => removeItem(current, code));
    },
  };
}

export type SellState = ReturnType<typeof useSellState>;
