"use client";

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { ITEM_MAX_KG } from "../../../convex/lib/households";
import { KG_PRESETS, parseKg, stepDown, stepUp } from "./draft";

/** Kilos as typed in the box: plain digits, one decimal at most. */
function kgText(kg: number): string {
  return String(Math.round(kg * 10) / 10);
}

/**
 * How many kilos of one material: − and + in steps that grow with the
 * amount, a box to type into, and one-tap amounts. At the smallest amount
 * the − becomes "remove".
 */
export function KgStepper({
  material,
  kg,
  onChange,
  onRemove,
}: {
  /** The material's name, for the buttons' labels. */
  material: string;
  kg: number;
  onChange: (kg: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("sell.basket");
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);
  const down = stepDown(kg);

  function commit() {
    if (typed === null) return;
    const next = parseKg(typed);
    setTyped(null);
    if (next !== null && next !== kg) onChange(next);
  }

  const buttonClass = "size-11 shrink-0 rounded-xl [&_svg]:size-5";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {down === null ? (
          <Button
            type="button"
            variant="outline"
            className={cn(buttonClass, "text-destructive")}
            aria-label={t("remove", { material })}
            onClick={onRemove}
          >
            <Trash2Icon aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className={buttonClass}
            aria-label={t("less", { material })}
            onClick={() => {
              onChange(down);
            }}
          >
            <MinusIcon aria-hidden />
          </Button>
        )}
        <div className="relative min-w-0 flex-1" dir="ltr">
          <Input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            aria-label={t("kilos", { material })}
            value={typed ?? kgText(kg)}
            onFocus={(event) => {
              event.target.select();
            }}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              commit();
            }}
            className="h-11 rounded-xl pe-10 text-center text-lg font-semibold tabular-nums"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground"
          >
            {t("kgUnit")}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          className={buttonClass}
          aria-label={t("more", { material })}
          disabled={kg >= ITEM_MAX_KG}
          onClick={() => {
            onChange(stepUp(kg));
          }}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
      <div
        role="group"
        aria-label={t("presets", { material })}
        className="flex flex-wrap gap-x-2 gap-y-1"
      >
        {KG_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="ghost"
            aria-pressed={kg === preset}
            onClick={() => {
              onChange(preset);
            }}
            className="h-11 min-w-11 rounded-none border-0 border-b-2 border-transparent px-2 tabular-nums aria-pressed:border-b-primary aria-pressed:text-foreground"
          >
            {t("preset", { kg: preset })}
          </Button>
        ))}
      </div>
    </div>
  );
}
