"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { kgToGrams } from "../../../convex/lib/chain";
import { FamilyIcon } from "./family";
import type { Material } from "./types";

/**
 * One material in the "What do you have?" grid: its family's icon and
 * colour, its name and today's price. Tapping adds it; tapping again takes
 * it out.
 */
export function MaterialTile({
  material,
  pricePaise,
  kg,
  isFull,
  onToggle,
}: {
  material: Material;
  /** Today's price per kg: undefined while prices load, null if none. */
  pricePaise: number | null | undefined;
  /** The kilos in the basket, or undefined when it isn't in the basket. */
  kg: number | undefined;
  /** The basket can't take another material. */
  isFull: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("sell");
  const format = useFormat();
  const isAdded = kg !== undefined;

  return (
    <button
      type="button"
      aria-pressed={isAdded}
      disabled={!isAdded && isFull}
      onClick={onToggle}
      className={cn(
        "group flex min-h-20 w-full items-center gap-3 border-b px-3 py-4 text-start transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 motion-reduce:transition-none",
        isAdded
          ? "border-primary bg-accent"
          : "border-border hover:bg-muted/40",
      )}
    >
      <FamilyIcon family={material.family} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm leading-snug font-medium">
          {format.material(material.names, material.code)}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {pricePaise === undefined ? <Skeleton className="h-4 w-14" /> : null}
          {typeof pricePaise === "number" ? (
            <span className="text-muted-foreground tabular-nums">
              {t("perKg", { price: format.perKg(pricePaise) })}
            </span>
          ) : null}
          {isAdded ? (
            <span className="font-semibold text-primary tabular-nums">
              {format.weight(kgToGrams(kg))}
            </span>
          ) : null}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded border",
          isAdded
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input text-muted-foreground",
        )}
      >
        {isAdded ? (
          <CheckIcon className="size-4" />
        ) : (
          <PlusIcon className="size-4" />
        )}
      </span>
    </button>
  );
}
