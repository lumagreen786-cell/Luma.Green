"use client";

import {
  CheckIcon,
  CloudOffIcon,
  LoaderIcon,
  LocateFixedIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isLocale, localeMeta } from "@/i18n/locales";
import { cn } from "@/lib/utils";

import { MAX_EXTRA_PHONES, WEEKDAYS } from "../../../convex/lib/onboarding";
import { formatIndianMobile } from "../../../convex/lib/phone";
import type { SaveState } from "./use-autosave";

function Hint({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  const t = useTranslations("join.errors");
  if (!error) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {t(error)}
    </p>
  );
}

/** Ids for a question's hint and error, and which one describes it now. */
export function describedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

/** A single input's label, hint and error. */
export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("join.form");
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label
        htmlFor={id}
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium"
      >
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">
            {" "}
            ({t("optional")})
          </span>
        ) : null}
      </Label>
      {children}
      <FieldError id={`${id}-error`} error={error} />
      {!error && hint ? <Hint id={`${id}-hint`} text={hint} /> : null}
    </div>
  );
}

/** A question answered with several controls: radios, chips, a list. */
export function FieldSet({
  id,
  legend,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  legend: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("join.form");
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-3"
      aria-describedby={describedBy(id, error, hint)}
    >
      <legend id={`${id}-legend`} className="mb-2 text-sm font-medium">
        {legend}
        {optional ? (
          <span className="font-normal text-muted-foreground">
            {" "}
            ({t("optional")})
          </span>
        ) : null}
      </legend>
      {children}
      <FieldError id={`${id}-error`} error={error} />
      {!error && hint ? <Hint id={`${id}-hint`} text={hint} /> : null}
    </fieldset>
  );
}

/**
 * One choice from a few, as large labelled radio controls. Named by the legend of the
 * `FieldSet` whose id matches `name`.
 */
export function OptionCards<T extends string>({
  name,
  options,
  value,
  onChange,
  invalid,
  columns = 2,
}: {
  name: string;
  options: readonly { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  invalid?: boolean;
  columns?: 1 | 2 | 3 | 4;
}) {
  const locale = useLocale();
  return (
    <RadioGroup
      dir={localeMeta[isLocale(locale) ? locale : "en"].dir}
      name={name}
      aria-labelledby={`${name}-legend`}
      value={value ?? ""}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next);
        if (option) onChange(option.value);
      }}
      className={cn(
        "grid gap-2",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const isSelected = option.value === value;
        return (
          <Label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 border-b px-2 py-3 text-sm font-normal",
              isSelected ? "border-primary text-primary" : "border-border",
            )}
          >
            <RadioGroupItem
              id={id}
              value={option.value}
              aria-invalid={invalid ? true : undefined}
            />
            {option.label}
          </Label>
        );
      })}
    </RadioGroup>
  );
}

export function YesNo({
  name,
  isYes,
  onChange,
  invalid,
}: {
  name: string;
  /** Unanswered until they tap one: never a silent default. */
  isYes: boolean | undefined;
  onChange: (isYes: boolean) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("join.form");
  let current: "yes" | "no" | undefined;
  if (isYes === true) current = "yes";
  else if (isYes === false) current = "no";
  return (
    <OptionCards
      name={name}
      options={[
        { value: "yes", label: t("yes") },
        { value: "no", label: t("no") },
      ]}
      value={current}
      onChange={(next) => {
        onChange(next === "yes");
      }}
      invalid={invalid}
    />
  );
}

/** Independent choices with compact, fully labelled checkbox targets. */
export function ToggleChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (value: T[]) => void;
}) {
  const groupId = useId();
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {options.map((option) => {
        const isChecked = value.includes(option.value);
        const id = `${groupId}-${option.value}`;
        return (
          <Label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex min-h-11 max-w-full cursor-pointer items-center gap-2.5 py-2 text-sm leading-normal font-normal",
              isChecked && "text-primary",
            )}
          >
            <Checkbox
              id={id}
              checked={isChecked}
              onCheckedChange={() => {
                onChange(
                  isChecked
                    ? value.filter((item) => item !== option.value)
                    : options
                        .map((candidate) => candidate.value)
                        .filter(
                          (item) =>
                            item === option.value || value.includes(item),
                        ),
                );
              }}
            />
            <span className="min-w-0 break-words">{option.label}</span>
          </Label>
        );
      })}
    </div>
  );
}

export function WeekdayChips({
  value,
  onChange,
}: {
  value: readonly (typeof WEEKDAYS)[number][];
  onChange: (value: (typeof WEEKDAYS)[number][]) => void;
}) {
  const t = useTranslations("join.form.weekdays");
  return (
    <ToggleChips
      options={WEEKDAYS.map((day) => ({ value: day, label: t(day) }))}
      value={value}
      onChange={onChange}
    />
  );
}

/** Opening and closing time, side by side. */
export function HoursInputs({
  id,
  opens,
  closes,
  onOpens,
  onCloses,
  invalid,
}: {
  id: string;
  opens: string | undefined;
  closes: string | undefined;
  onOpens: (value: string) => void;
  onCloses: (value: string) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("join.form");
  return (
    <div className="grid grid-cols-2 gap-3" dir="ltr">
      <div className="flex flex-col gap-1">
        <Label
          htmlFor={`${id}-opens`}
          className="text-sm text-muted-foreground"
        >
          {t("opens")}
        </Label>
        <Input
          id={`${id}-opens`}
          type="time"
          className="h-12 text-lg"
          value={opens ?? ""}
          onChange={(event) => {
            onOpens(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label
          htmlFor={`${id}-closes`}
          className="text-sm text-muted-foreground"
        >
          {t("closes")}
        </Label>
        <Input
          id={`${id}-closes`}
          type="time"
          className="h-12 text-lg"
          value={closes ?? ""}
          aria-invalid={invalid ? true : undefined}
          onChange={(event) => {
            onCloses(event.target.value);
          }}
        />
      </div>
    </div>
  );
}

interface ExtraPhone {
  number: string;
  label: string;
}

/** The login number (fixed) plus up to two more, each with a label. */
export function PhoneList({
  loginPhone,
  value,
  onChange,
  errors,
}: {
  loginPhone: string | undefined;
  value: readonly ExtraPhone[];
  onChange: (value: ExtraPhone[]) => void;
  errors?: readonly ({ number?: string; label?: string } | undefined)[];
}) {
  const t = useTranslations("join.form");
  const tErrors = useTranslations("join.errors");
  const update = (index: number, patch: Partial<ExtraPhone>) => {
    onChange(
      value.map((phone, at) => (at === index ? { ...phone, ...patch } : phone)),
    );
  };
  return (
    <div className="flex flex-col gap-3">
      {loginPhone ? (
        <p className="border-s-2 border-primary py-2 ps-3 text-sm">
          {t("loginPhone")}:{" "}
          <span className="font-medium" dir="ltr">
            {formatIndianMobile(loginPhone)}
          </span>
        </p>
      ) : null}
      {value.map((phone, index) => {
        const error = errors?.[index];
        return (
          <div
            // Rows have no id of their own; position is their identity here.

            key={index}
            className="flex flex-col gap-3 border-b border-border pb-4"
          >
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor={`phone-${String(index)}-number`}
                  className="text-sm text-muted-foreground"
                >
                  {t("phoneNumber")}
                </Label>
                <Input
                  id={`phone-${String(index)}-number`}
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  className="h-11"
                  placeholder="98765 43210"
                  value={phone.number}
                  aria-invalid={error?.number ? true : undefined}
                  onChange={(event) => {
                    update(index, { number: event.target.value });
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={t("remove")}
                onClick={() => {
                  onChange(value.filter((_, at) => at !== index));
                }}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              <Label
                htmlFor={`phone-${String(index)}-label`}
                className="text-sm text-muted-foreground"
              >
                {t("phoneLabel")}
              </Label>
              <Input
                id={`phone-${String(index)}-label`}
                className="h-11"
                placeholder={t("phoneLabelPlaceholder")}
                value={phone.label}
                aria-invalid={error?.label ? true : undefined}
                onChange={(event) => {
                  update(index, { label: event.target.value });
                }}
              />
            </div>
            {error?.number || error?.label ? (
              <p role="alert" className="text-sm text-destructive">
                {tErrors(error.number ?? error.label ?? "generic")}
              </p>
            ) : null}
          </div>
        );
      })}
      {value.length < MAX_EXTRA_PHONES ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => {
            onChange([...value, { number: "", label: "" }]);
          }}
        >
          <PlusIcon aria-hidden />
          {t("addPhone")}
        </Button>
      ) : null}
    </div>
  );
}

/** "Use my location": fills the map pin from the phone's GPS. */
export function LocationButton({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | undefined;
  onChange: (value: { lat: number; lng: number }) => void;
}) {
  const t = useTranslations("join.form");
  const [state, setState] = useState<"idle" | "locating" | "failed">("idle");

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("failed");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
        setState("idle");
      },
      () => {
        setState("failed");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 self-start px-3 sm:px-4"
        disabled={state === "locating"}
        onClick={locate}
      >
        {state === "locating" ? (
          <LoaderIcon
            aria-hidden
            className="hidden animate-spin motion-reduce:animate-none sm:block"
          />
        ) : (
          <LocateFixedIcon aria-hidden className="hidden sm:block" />
        )}
        {t(state === "locating" ? "locating" : "useLocation")}
      </Button>
      <p aria-live="polite" className="text-sm">
        {value && state !== "failed" ? (
          <span className="inline-flex items-center gap-1.5 text-primary">
            <CheckIcon aria-hidden className="size-4" />
            {t("locationSaved")}
          </span>
        ) : null}
        {state === "failed" ? (
          <span className="text-destructive">{t("locationFailed")}</span>
        ) : null}
        {!value && state === "idle" ? (
          <span className="text-muted-foreground">{t("locationWhy")}</span>
        ) : null}
      </p>
    </div>
  );
}

/** Short free-text tags (area names), added one by one. */
export function TagInput({
  id,
  value,
  onChange,
  buttonLabel,
  max,
}: {
  id: string;
  value: readonly string[];
  onChange: (value: string[]) => void;
  buttonLabel: string;
  max: number;
}) {
  const t = useTranslations("join.form");
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim();
    if (tag.length < 2 || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id={id}
          className="h-11"
          value={draft}
          maxLength={40}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }

            event.preventDefault();
            add();
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={value.length >= max}
          onClick={add}
        >
          {buttonLabel}
        </Button>
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-lg bg-muted ps-3 text-sm"
            >
              {tag}
              <button
                type="button"
                aria-label={`${t("remove")}: ${tag}`}
                className="inline-flex size-11 items-center justify-center rounded-lg outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => {
                  onChange(value.filter((item) => item !== tag));
                }}
              >
                <XIcon aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "Saving… / Saved / Not saved", next to the form's title. */
export function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("join.form");
  if (state === "idle") return null;
  return (
    <p
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        state === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {state === "saving" ? (
        <LoaderIcon
          aria-hidden
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {state === "saved" ? <CheckIcon aria-hidden className="size-4" /> : null}
      {state === "error" ? (
        <CloudOffIcon aria-hidden className="size-4" />
      ) : null}
      {state === "saving" ? t("saving") : null}
      {state === "saved" ? t("saved") : null}
      {state === "error" ? t("notSaved") : null}
    </p>
  );
}
