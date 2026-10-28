"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { isLocale, localeDirection } from "@/i18n/locales";

import {
  canonicalCityName,
  INDIA_STATES_AND_UTS,
  localityParts,
} from "../../../convex/lib/geography";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface CityLabels {
  city: string;
  state: string;
  choose: string;
  cityError: string;
}
interface CityProps {
  value: string;
  onChange: (city: string) => void;
  error?: boolean;
  onBlur?: () => void;
  labels?: CityLabels;
}

/** One locality owner for translated public forms and the English-only admin. */
export function CityField(props: CityProps) {
  return props.labels ? (
    <CityControls {...props} labels={props.labels} direction="ltr" />
  ) : (
    <TranslatedCityField {...props} />
  );
}
function TranslatedCityField(props: CityProps) {
  const t = useTranslations("join");
  const locale = useLocale();
  return (
    <CityControls
      {...props}
      labels={{
        city: t("form.city"),
        state: t("form.stateUT"),
        choose: t("errors.chooseOne"),
        cityError: t("errors.city"),
      }}
      direction={isLocale(locale) ? localeDirection(locale) : "ltr"}
    />
  );
}
function CityControls({
  value,
  onChange,
  error,
  onBlur,
  labels,
  direction,
}: CityProps & { labels: CityLabels; direction: "ltr" | "rtl" }) {
  const id = useId();
  const { city, state } = localityParts(value);
  const isCityInvalid =
    (city.length > 0 || error === true) && canonicalCityName(city) === null;
  const isStateInvalid = (value.length > 0 || error === true) && !state;
  function change(cityValue: string, stateValue: string) {
    onChange(stateValue ? `${cityValue}, ${stateValue}` : cityValue);
  }
  return (
    <div className="grid max-w-xl min-w-0 gap-4 sm:grid-cols-2" dir={direction}>
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${id}-city`}>{labels.city}</Label>
        <Input
          id={`${id}-city`}
          autoComplete="address-level2"
          maxLength={60}
          value={city}
          onChange={(event) => {
            change(event.target.value, state);
          }}
          onBlur={onBlur}
          aria-invalid={isCityInvalid || undefined}
          aria-describedby={isCityInvalid ? `${id}-city-error` : undefined}
        />
        {isCityInvalid ? (
          <p
            id={`${id}-city-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {labels.cityError}
          </p>
        ) : null}
      </div>
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${id}-state`}>{labels.state}</Label>
        <Select
          dir={direction}
          value={state}
          onValueChange={(selected) => {
            change(city, selected);
          }}
        >
          <SelectTrigger
            id={`${id}-state`}
            className="h-auto w-full min-w-0 text-start whitespace-normal [&_[data-slot=select-value]]:line-clamp-none"
            onBlur={onBlur}
            aria-invalid={isStateInvalid || undefined}
            aria-describedby={isStateInvalid ? `${id}-state-error` : undefined}
          >
            <SelectValue placeholder={labels.choose} />
          </SelectTrigger>
          <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
            {INDIA_STATES_AND_UTS.map((name) => (
              <SelectItem className="whitespace-normal" key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isStateInvalid ? (
          <p
            id={`${id}-state-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {labels.choose}
          </p>
        ) : null}
      </div>
    </div>
  );
}
