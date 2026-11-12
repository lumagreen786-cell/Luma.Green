"use client";

import {
  ClockIcon,
  type LucideIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { isLocale, localeMeta } from "@/i18n/locales";
import { cn } from "@/lib/utils";

import { shiftDate } from "../../../convex/lib/dates";
import {
  ADDRESS_LENGTH,
  bookableDates,
  isWindowOpen,
  NAME_LENGTH,
  SLOT_DAYS_AHEAD,
  SLOT_WINDOWS,
  type SlotWindow,
} from "../../../convex/lib/households";
import type { SellDraft, WhenField } from "./draft";
import { useTimeFormat } from "./time";
import type { ShopOffer } from "./types";

const WINDOW_ICONS: Record<SlotWindow, LucideIcon> = {
  morning: SunriseIcon,
  afternoon: SunIcon,
  evening: SunsetIcon,
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function choiceClass(isSelected: boolean, isDisabled: boolean) {
  return cn(
    "border-b font-normal",
    isSelected ? "border-primary text-foreground" : "border-border",
    isDisabled
      ? "cursor-not-allowed opacity-50"
      : "cursor-pointer hover:bg-muted/40",
  );
}

function Question({
  id,
  legend,
  error,
  children,
}: {
  id: string;
  legend: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset
      data-field={id}
      className="flex min-w-0 flex-col gap-2"
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend id={`${id}-legend`} className="mb-2 font-semibold">
        {legend}
      </legend>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}

/**
 * Step 3, "When?": a day in the next week, a time of day, and for a pickup
 * the address. The household's name goes with the booking so the shop knows
 * who to ask for.
 */
export function WhenStep({
  draft,
  shop,
  today,
  now,
  problems,
  onChange,
}: {
  draft: SellDraft;
  shop: ShopOffer | undefined;
  today: string;
  now: number;
  /** What to point out — filled once they've tried to go on. */
  problems: readonly WhenField[];
  onChange: (change: Partial<SellDraft>) => void;
}) {
  const t = useTranslations("sell");
  const locale = useLocale();
  const time = useTimeFormat();
  const errorFor = (field: WhenField) =>
    problems.includes(field) ? t(`when.errors.${field}`) : undefined;
  const isOpen = (date: string, window: SlotWindow) =>
    isWindowOpen(date, window, today, now);
  // The next seven days that still have a time open: late in the evening,
  // today drops off and next week's day comes in.
  const days = bookableDates(today)
    .filter((date) => SLOT_WINDOWS.some((window) => isOpen(date, window)))
    .slice(0, SLOT_DAYS_AHEAD);
  const hours = time.hours(shop?.hours);
  const dayName = (date: string) => {
    if (date === today) return t("when.today");
    return date === shiftDate(today, 1) ? t("when.tomorrow") : null;
  };

  return (
    <div className="flex flex-col gap-6">
      <Question id="day" legend={t("when.dayLabel")} error={errorFor("day")}>
        <RadioGroup
          dir={localeMeta[isLocale(locale) ? locale : "en"].dir}
          aria-labelledby="day-legend"
          value={draft.slotDate ?? ""}
          onValueChange={(slotDate) => {
            const isStillOpen =
              draft.slotWindow !== undefined &&
              isOpen(slotDate, draft.slotWindow);
            onChange({
              slotDate,
              slotWindow: isStillOpen ? draft.slotWindow : undefined,
            });
          }}
          className="flex flex-wrap gap-x-4 gap-y-1"
        >
          {days.map((date) => {
            const parts = time.dayParts(date);
            return (
              <Label
                key={date}
                htmlFor={`day-${date}`}
                className={cn(
                  choiceClass(draft.slotDate === date, false),
                  "relative flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                )}
              >
                <RadioGroupItem
                  id={`day-${date}`}
                  value={date}
                  className="sr-only"
                />
                <span className="text-xs text-muted-foreground">
                  {dayName(date) ?? parts.weekday}
                </span>
                <span className="text-sm font-semibold">{parts.date}</span>
              </Label>
            );
          })}
        </RadioGroup>
      </Question>

      <Question
        id="window"
        legend={t("when.windowLabel")}
        error={errorFor("window")}
      >
        <RadioGroup
          dir={localeMeta[isLocale(locale) ? locale : "en"].dir}
          aria-labelledby="window-legend"
          value={draft.slotWindow ?? ""}
          onValueChange={(value) => {
            const slotWindow = SLOT_WINDOWS.find((window) => window === value);
            if (slotWindow) onChange({ slotWindow });
          }}
          className="grid gap-x-5 gap-y-0 sm:grid-cols-3"
        >
          {SLOT_WINDOWS.map((window) => {
            const Icon = WINDOW_ICONS[window];
            const isDisabled =
              draft.slotDate !== undefined && !isOpen(draft.slotDate, window);
            return (
              <Label
                key={window}
                htmlFor={`window-${window}`}
                className={cn(
                  choiceClass(draft.slotWindow === window, isDisabled),
                  "flex min-h-14 items-center gap-3 py-3",
                )}
              >
                <RadioGroupItem
                  id={`window-${window}`}
                  value={window}
                  disabled={isDisabled}
                />
                <Icon aria-hidden className="size-5 shrink-0 text-foreground" />
                <span className="flex flex-col">
                  <span className="text-base font-semibold">
                    {t(`windows.${window}`)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {isDisabled ? t("when.passed") : time.window(window)}
                  </span>
                </span>
              </Label>
            );
          })}
        </RadioGroup>
      </Question>

      {draft.mode === "pickup" ? (
        <div data-field="address" className="flex flex-col gap-2">
          <Label htmlFor="address" className="text-base font-semibold">
            {t("when.addressLabel")}
          </Label>
          <Textarea
            id="address"
            rows={3}
            autoComplete="street-address"
            maxLength={ADDRESS_LENGTH.max}
            value={draft.address}
            aria-invalid={errorFor("address") ? true : undefined}
            aria-describedby={
              errorFor("address") ? "address-error" : "address-hint"
            }
            onChange={(event) => {
              onChange({ address: event.target.value });
            }}
            className="min-h-24 text-base"
          />
          <FieldError id="address-error" message={errorFor("address")} />
          {errorFor("address") ? null : (
            <p id="address-hint" className="text-sm text-muted-foreground">
              {t("when.addressHint")}
            </p>
          )}
          <p className="flex gap-2 text-sm text-muted-foreground">
            <ShieldCheckIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-foreground"
            />
            {t("when.privacy")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 border-y border-border py-4">
          <p className="text-sm text-muted-foreground">{t("when.dropoffAt")}</p>
          <p className="font-semibold">{shop?.name}</p>
          <p className="flex gap-2 text-sm">
            <MapPinIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-foreground"
            />
            {shop?.address}
          </p>
          {hours ? (
            <p className="flex gap-2 text-sm">
              <ClockIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-foreground"
              />
              {t("shop.hours", { hours })}
            </p>
          ) : null}
        </div>
      )}

      <div data-field="name" className="flex flex-col gap-2">
        <Label htmlFor="name" className="text-base font-semibold">
          {t("when.nameLabel")}
        </Label>
        <Input
          id="name"
          autoComplete="name"
          maxLength={NAME_LENGTH.max}
          value={draft.name}
          aria-invalid={errorFor("name") ? true : undefined}
          aria-describedby={errorFor("name") ? "name-error" : "name-hint"}
          onChange={(event) => {
            onChange({ name: event.target.value });
          }}
          className="h-12 text-base"
        />
        <FieldError id="name-error" message={errorFor("name")} />
        {errorFor("name") ? null : (
          <p id="name-hint" className="text-sm text-muted-foreground">
            {t("when.nameHint")}
          </p>
        )}
      </div>
    </div>
  );
}
