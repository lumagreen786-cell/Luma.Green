"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UseFormRegisterReturn } from "react-hook-form";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { Field, helpId } from "./field";
import { isFarFromSuggestion, NOTE_MAX_LENGTH } from "./logic";
import { MaterialIcon } from "./material-icon";
import type { SellableItem } from "./types";

/** The sell form's fields, one question each. */

/** What to sell: a radio list of materials in stock, with what's free. */
export function MaterialChoice({
  items,
  value,
  error,
  onChange,
}: {
  items: readonly SellableItem[];
  value: string;
  error: string | undefined;
  onChange: (code: string) => void;
}) {
  const t = useTranslations("market.sell.form");
  const format = useFormat();
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-3"
      aria-describedby={error ? "listing-material-error" : undefined}
    >
      <legend
        id="listing-material-legend"
        className="mb-1 text-base font-medium"
      >
        {t("material")}
      </legend>
      <RadioGroup
        name="materialCode"
        aria-labelledby="listing-material-legend"
        value={value}
        onValueChange={onChange}
        className="flex flex-col"
      >
        {items.map((item) => {
          const code = item.material.code;
          const id = `listing-material-${code}`;
          const isAllPromised = item.availableGrams <= 0;
          return (
            <Label
              key={code}
              htmlFor={id}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 border-b py-3 text-base leading-normal font-normal",
                code === value
                  ? "border-primary text-foreground"
                  : "border-border",
                isAllPromised && "cursor-not-allowed opacity-60",
              )}
            >
              <RadioGroupItem
                id={id}
                value={code}
                disabled={isAllPromised}
                aria-invalid={error ? true : undefined}
              />
              <MaterialIcon family={item.material.family} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {format.material(item.material.names, code)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {isAllPromised
                    ? t("allPromised")
                    : t("free", { weight: format.weight(item.availableGrams) })}
                </span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>
      {error ? (
        <p
          id="listing-material-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** How much: kg, with a one-tap "All" for what's free to sell. */
export function KgField({
  input,
  error,
  availableGrams,
  onAll,
}: {
  input: UseFormRegisterReturn;
  error: string | undefined;
  availableGrams: number | null;
  onAll: () => void;
}) {
  const t = useTranslations("market");
  const format = useFormat();
  const available =
    availableGrams === null ? null : format.weight(availableGrams);
  return (
    <Field
      id="listing-kg"
      label={t("sell.form.kg")}
      error={error}
      hint={available ? t("sell.form.kgHint", { weight: available }) : null}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="listing-kg"
            inputMode="decimal"
            autoComplete="off"
            className="h-12 pe-10 text-lg tabular-nums"
            aria-invalid={error ? true : undefined}
            aria-describedby={helpId("listing-kg", error, available !== null)}
            {...input}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {t("units.kg")}
          </span>
        </div>
        {available ? (
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={onAll}
          >
            {t("sell.form.all", { weight: available })}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

/**
 * The asking price in rupees per kg, with today's market price and the
 * suggestion beside it — and a warning when it's far from either.
 */
export function PriceField({
  input,
  error,
  todayPaise,
  suggestion,
  paise,
  onUse,
}: {
  input: UseFormRegisterReturn;
  error: string | undefined;
  todayPaise: number | null;
  suggestion: number | null;
  paise: number | null;
  onUse: (paise: number) => void;
}) {
  const t = useTranslations("market");
  const format = useFormat();
  const hasHint = todayPaise !== null || suggestion !== null;
  return (
    <div className="flex flex-col gap-3">
      <Field
        id="listing-price"
        label={t("sell.form.price")}
        error={error}
        hint={
          hasHint ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {todayPaise === null ? null : (
                <span>
                  {t("sell.form.market", { price: format.perKg(todayPaise) })}
                </span>
              )}
              {suggestion === null ? null : (
                <span className="font-medium text-foreground">
                  {t("sell.form.suggested", {
                    price: format.perKg(suggestion),
                  })}
                </span>
              )}
              {suggestion === null || paise === suggestion ? null : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto min-h-11 px-0 text-sm"
                  onClick={() => {
                    onUse(suggestion);
                  }}
                >
                  {t("sell.form.useSuggested", {
                    price: format.perKg(suggestion),
                  })}
                </Button>
              )}
            </div>
          ) : null
        }
      >
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground"
          >
            {t("units.rupee")}
          </span>
          <Input
            id="listing-price"
            inputMode="decimal"
            autoComplete="off"
            className="h-12 ps-8 text-lg tabular-nums"
            aria-invalid={error ? true : undefined}
            aria-describedby={helpId("listing-price", error, hasHint)}
            {...input}
          />
        </div>
      </Field>
      {isFarFromSuggestion(paise, suggestion) ? (
        <p className="flex gap-2 border-s-2 border-border ps-3 text-sm text-muted-foreground">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("sell.form.farFromMarket")}
        </p>
      ) : null}
    </div>
  );
}

/** An optional note for buyers, with a character count. */
export function NoteField({
  input,
  error,
  length,
}: {
  input: UseFormRegisterReturn;
  error: string | undefined;
  length: number;
}) {
  const t = useTranslations("market.sell.form");
  return (
    <Field
      id="listing-note"
      label={
        <>
          {t("note")}
          <span className="font-normal text-muted-foreground">
            {t("optional")}
          </span>
        </>
      }
      error={error}
      hint={t("noteCount", { count: length, max: NOTE_MAX_LENGTH })}
    >
      <Textarea
        id="listing-note"
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        placeholder={t("notePlaceholder")}
        className="min-h-20 text-base"
        aria-invalid={error ? true : undefined}
        aria-describedby={helpId("listing-note", error, true)}
        {...input}
      />
    </Field>
  );
}
