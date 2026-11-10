"use client";

import { useMutation } from "convex/react";
import { BanknoteIcon, CheckIcon, PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCanOperate } from "@/components/workspace/permissions";
import { defaultLocale, isLocale, localeDirection } from "@/i18n/locales";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { kgToGrams } from "../../../convex/lib/chain";
import { actionErrorKey } from "./bookings";
import { MaterialIcon } from "./material-icon";
import type { BookingView, MaterialRef } from "./types";
import { kgInput, parseKg, priceLines } from "./weigh";
import { WeighRow, type WeighRowValue } from "./weigh-row";

type Problem = "invalidKg" | "nothing" | "changed" | "generic";

const PROBLEM_KEYS: Record<Problem, string> = {
  invalidKg: "weigh.invalidKg",
  nothing: "weigh.nothing",
  changed: "errors.changed",
  generic: "errors.generic",
};

/**
 * Weigh and pay: one row per material, prefilled with the household's guess;
 * the amount at the shop's prices as they type; direct cash; confirm. The
 * weight, not the guess, is what's paid and what goes into stock.
 */
export function WeighAndPay({
  bookingId,
  items,
  rates,
  choices,
}: {
  bookingId: Id<"bookings">;
  items: BookingView["items"];
  /** Paise per kg by material code: the shop's price, else the city's. */
  rates: ReadonlyMap<string, number>;
  /** Materials that can be added: what the shop buys. */
  choices: readonly MaterialRef[];
}) {
  const canOperate = useCanOperate();
  const t = useTranslations("shop");
  const locale = useLocale();
  const direction = localeDirection(isLocale(locale) ? locale : defaultLocale);
  const format = useFormat();
  const complete = useMutation(api.shop.complete);
  const [rows, setRows] = useState<WeighRowValue[]>(() =>
    items.map((item, index) => ({
      key: `item-${String(index)}`,
      material: item.material,
      text: kgInput(kgToGrams(item.estKg)),
      estGrams: kgToGrams(item.estKg),
    })),
  );
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const addedCount = useRef(0);

  // Put the cursor in the kg field of a material just added.
  useEffect(() => {
    if (added) inputs.current.get(added)?.focus();
  }, [added]);

  const weighed = rows.map((row) => ({
    materialCode: row.material.code,
    grams: parseKg(row.text),
  }));
  const { totalPaise } = priceLines(
    weighed.map((line) => ({ ...line, grams: line.grams ?? 0 })),
    rates,
  );
  const addable = choices.filter((material) =>
    rows.every((row) => row.material.code !== material.code),
  );

  const update = (key: string, text: string) => {
    setProblem(null);
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, text } : row)),
    );
  };

  const remove = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const add = (code: string) => {
    const material = choices.find((choice) => choice.code === code);
    if (!material) return;
    addedCount.current += 1;
    const key = `added-${String(addedCount.current)}`;
    setRows((current) => [
      ...current,
      { key, material, text: "", estGrams: null },
    ]);
    setAdded(key);
  };

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (weighed.some((line) => line.grams === null)) {
      setProblem("invalidKg");
      return;
    }
    const lines = weighed
      .map((line) => ({
        materialCode: line.materialCode,
        grams: line.grams ?? 0,
      }))
      .filter((line) => line.grams > 0);
    if (lines.length === 0) {
      setProblem("nothing");
      return;
    }
    setProblem(null);
    setIsSaving(true);
    try {
      await complete({ bookingId, lines, method: "cash" });
      toast.success(t("weigh.done"));
    } catch (error) {
      setProblem(actionErrorKey(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (!canOperate) return null;
  return (
    <section
      id="weigh"
      aria-labelledby="weigh-title"
      className="flex scroll-mt-20 flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="weigh-title" className="text-lg font-semibold">
          {t("weigh.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("weigh.lead")}</p>
      </div>
      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <WeighRow
              key={row.key}
              row={row}
              paisePerKg={rates.get(row.material.code) ?? null}
              onChange={(text) => {
                update(row.key, text);
              }}
              onRemove={() => {
                remove(row.key);
              }}
              inputRef={(element) => {
                if (element) inputs.current.set(row.key, element);
                else inputs.current.delete(row.key);
              }}
            />
          ))}
        </ul>

        {addable.length > 0 ? (
          <Select dir={direction} value="" onValueChange={add}>
            <SelectTrigger
              aria-label={t("weigh.add")}
              className="h-12 w-full border-dashed text-base data-[size=default]:h-12"
            >
              <PlusIcon aria-hidden className="size-5 text-primary" />
              <SelectValue placeholder={t("weigh.add")} />
            </SelectTrigger>
            <SelectContent>
              {addable.map((material) => (
                <SelectItem
                  key={material.code}
                  value={material.code}
                  className="min-h-11 text-base"
                >
                  <MaterialIcon family={material.family} size="sm" />
                  {format.material(material.names, material.code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex flex-col gap-5 border-t-2 border-primary pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-medium">{t("weigh.total")}</span>
            <output
              aria-live="polite"
              className="text-3xl font-semibold tracking-tight tabular-nums"
            >
              {format.money(totalPaise)}
            </output>
          </div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <BanknoteIcon aria-hidden className="size-5" />
            {t("methods.cash")}
          </p>
          {problem ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {t(PROBLEM_KEYS[problem])}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="h-12 text-base"
            disabled={isSaving}
          >
            <CheckIcon aria-hidden className="size-5" />
            {isSaving
              ? t("weigh.saving")
              : t("weigh.confirm", { amount: format.money(totalPaise) })}
          </Button>
        </div>
      </form>
    </section>
  );
}
