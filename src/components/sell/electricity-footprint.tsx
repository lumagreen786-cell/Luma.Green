"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GRID_FACTOR_SOURCE,
  gridElectricityFootprint,
} from "@/lib/household-footprint";

export function ElectricityFootprint() {
  const t = useTranslations("householdTools");
  const locale = useLocale();
  const format = useFormatter();
  const [reading, setReading] = useState("");
  const [estimate, setEstimate] = useState<number | null>();
  return (
    <form
      className="grid items-start gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
      onSubmit={(event) => {
        event.preventDefault();
        setEstimate(gridElectricityFootprint(reading, locale));
      }}
    >
      <div className="flex flex-col gap-5 rounded-[1.75rem] bg-card p-5 text-card-foreground sm:p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="electricity-reading">{t("electricityReading")}</Label>
          <Input
            id="electricity-reading"
            inputMode="decimal"
            maxLength={20}
            value={reading}
            onChange={(event) => {
              setReading(event.target.value);
              setEstimate(undefined);
            }}
            aria-invalid={estimate === null}
            aria-describedby={
              estimate === null ? "electricity-error" : undefined
            }
          />
          {estimate === null ? (
            <p
              id="electricity-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {t("invalidReading")}
            </p>
          ) : null}
        </div>
        <ActionButton
          type="submit"
          className="self-start"
          label={t("calculate")}
        />
      </div>
      <div className="flex flex-col gap-4 rounded-[1.75rem] bg-card p-5 text-card-foreground sm:p-6">
        <output
          aria-live="polite"
          className={
            estimate === undefined || estimate === null
              ? "sr-only"
              : "rounded-xl bg-accent p-5 text-2xl font-semibold tabular-nums"
          }
        >
          {estimate === undefined || estimate === null
            ? null
            : t("estimate", {
                amount: format.number(estimate, {
                  maximumSignificantDigits: 5,
                }),
              })}
        </output>
        <p className="text-sm text-muted-foreground">
          {t("privateCalculation")}
        </p>
        <a
          href={GRID_FACTOR_SOURCE}
          className="self-start py-2 text-sm text-foreground underline underline-offset-4"
        >
          {t("gridSource")}
        </a>
      </div>
    </form>
  );
}
