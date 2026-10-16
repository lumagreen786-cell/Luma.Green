"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";

import { kgToGrams, paiseFor } from "../../../convex/lib/chain";
import {
  BASKET_MAX_ITEMS,
  type BasketItem,
} from "../../../convex/lib/households";
import { FAMILIES, FamilyIcon } from "./family";
import { KgStepper } from "./kg-stepper";
import { MaterialTile } from "./material-tile";
import type { Material, PriceMap } from "./types";

/** Materials under their family, families in the order households see them. */
function byFamily(materials: readonly Material[]) {
  return FAMILIES.map((family) => ({
    family,
    materials: materials.filter((material) => material.family === family),
  })).filter((group) => group.materials.length > 0);
}

/** A price for a tile: undefined while loading, null when there's none. */
function priceFor(prices: PriceMap | undefined, code: string) {
  return prices === undefined ? undefined : (prices.get(code) ?? null);
}

/**
 * Step 1, "What do you have?": every material households sell, grouped by
 * family, then the chosen ones with their kilos and what they're worth.
 */
export function BasketStep({
  materials,
  prices,
  items,
  onToggle,
  onSetKg,
  onRemove,
}: {
  materials: readonly Material[];
  prices: PriceMap | undefined;
  items: readonly BasketItem[];
  onToggle: (material: Material) => void;
  onSetKg: (materialCode: string, kg: number) => void;
  onRemove: (materialCode: string) => void;
}) {
  const t = useTranslations("sell");
  const kgByCode = new Map(items.map((item) => [item.materialCode, item.kg]));
  const isFull = items.length >= BASKET_MAX_ITEMS;
  const groups = byFamily(materials);
  const [chosenFamily, setChosenFamily] = useState<string>();
  const activeFamily = chosenFamily ?? groups[0]?.family;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" aria-label={t("steps.basket")}>
        {groups.map(({ family }) => (
          <Button
            key={family}
            type="button"
            variant={activeFamily === family ? "default" : "outline"}
            aria-pressed={activeFamily === family}
            onClick={() => {
              setChosenFamily(family);
            }}
          >
            <FamilyIcon family={family} size="sm" />
            {t(`families.${family}`)}
          </Button>
        ))}
      </div>
      {groups
        .filter(({ family }) => family === activeFamily)
        .map(({ family, materials: group }) => (
          <section
            key={family}
            aria-labelledby={`family-${family}`}
            className="flex flex-col gap-2"
          >
            <h3
              id={`family-${family}`}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
            >
              <FamilyIcon family={family} size="sm" />
              {t(`families.${family}`)}
            </h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.map((material) => (
                <li key={material.code}>
                  <MaterialTile
                    material={material}
                    pricePaise={priceFor(prices, material.code)}
                    kg={kgByCode.get(material.code)}
                    isFull={isFull}
                    onToggle={() => {
                      onToggle(material);
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}

      {isFull ? (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-200">
          {t("basket.full", { max: BASKET_MAX_ITEMS })}
        </p>
      ) : null}

      <BasketList
        materials={materials}
        prices={prices}
        items={items}
        onSetKg={onSetKg}
        onRemove={onRemove}
      />
    </div>
  );
}

function BasketList({
  materials,
  prices,
  items,
  onSetKg,
  onRemove,
}: {
  materials: readonly Material[];
  prices: PriceMap | undefined;
  items: readonly BasketItem[];
  onSetKg: (materialCode: string, kg: number) => void;
  onRemove: (materialCode: string) => void;
}) {
  const t = useTranslations("sell");
  const byCode = new Map(
    materials.map((material) => [material.code, material]),
  );

  return (
    <section
      aria-labelledby="basket-title"
      className="flex flex-col border-y border-border bg-muted/30"
    >
      <h3 id="basket-title" className="px-4 pt-4 text-lg font-semibold">
        {t("basket.yours")}
      </h3>
      {items.length === 0 ? (
        <p className="px-4 pt-1 pb-4 text-sm text-muted-foreground">
          {t("basket.empty")}
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const material = byCode.get(item.materialCode);
            if (!material) return null;
            return (
              <BasketLine
                key={item.materialCode}
                item={item}
                material={material}
                pricePaise={prices?.get(item.materialCode)}
                onSetKg={(kg) => {
                  onSetKg(item.materialCode, kg);
                }}
                onRemove={() => {
                  onRemove(item.materialCode);
                }}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** One chosen material: its price, what it's worth now, and its kilos. */
function BasketLine({
  item,
  material,
  pricePaise,
  onSetKg,
  onRemove,
}: {
  item: BasketItem;
  material: Material;
  pricePaise: number | undefined;
  onSetKg: (kg: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("sell");
  const format = useFormat();
  const name = format.material(material.names, material.code);
  const worth =
    pricePaise === undefined
      ? undefined
      : format.money(paiseFor(kgToGrams(item.kg), pricePaise));

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <FamilyIcon family={material.family} />
        <div className="flex min-w-0 flex-1 basis-28 flex-col">
          <span className="font-medium [overflow-wrap:anywhere]">{name}</span>
          {pricePaise === undefined ? null : (
            <span className="text-sm text-muted-foreground tabular-nums">
              {t("perKg", { price: format.perKg(pricePaise) })}
            </span>
          )}
        </div>
        {worth === undefined ? null : (
          <span className="max-w-full font-semibold tabular-nums">
            {t("basket.lineValue", { amount: worth })}
          </span>
        )}
      </div>
      <KgStepper
        material={name}
        kg={item.kg}
        onChange={onSetKg}
        onRemove={onRemove}
      />
    </li>
  );
}
