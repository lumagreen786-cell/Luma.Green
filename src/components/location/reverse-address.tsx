"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { useReverseAddress } from "./use-reverse-address";

/** An explicit lookup and explicit replacement; GPS never replaces entered text. */
function LocatedReverseAddress({
  point,
  address,
  onUse,
}: {
  point: { lat: number; lng: number } | undefined;
  address: string;
  onUse: (address: string) => void;
}) {
  const t = useTranslations("geocoding");
  const id = useId();
  const [consentKey, setConsentKey] = useState<string | null>(null);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const { state, lookup, identityKey } = useReverseAddress(point, address);
  const pointKey = JSON.stringify([identityKey, point]);
  const confirmationKey = JSON.stringify([
    identityKey,
    point,
    address,
    state.status === "found" ? state.address : "",
  ]);
  if (!point) return null;
  const hasConsent = consentKey === pointKey;
  const isConfirmed = confirmedKey === confirmationKey;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Checkbox
          id={`${id}-consent`}
          checked={hasConsent}
          onCheckedChange={(value) => {
            setConsentKey(value === true ? pointKey : null);
          }}
        />
        <Label
          htmlFor={`${id}-consent`}
          className="text-sm leading-relaxed font-normal"
        >
          {t("consent")}
        </Label>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={!hasConsent || state.status === "loading"}
        onClick={() => {
          void lookup();
        }}
      >
        {t(state.status === "loading" ? "loading" : "find")}
      </Button>
      <p className="text-sm text-muted-foreground">{t("manual")}</p>
      {state.status === "unavailable" ? (
        <p role="status" className="text-sm">
          {t("unavailable")}
        </p>
      ) : null}
      {state.status === "found" ? (
        <div className="space-y-3 border-s-2 ps-3" role="status">
          <p>{state.address}</p>
          <p
            translate="no"
            className="notranslate font-sans text-sm font-normal tracking-normal whitespace-nowrap text-google-attribution not-italic"
          >
            {t("attribution")}
          </p>
          {state.allowAddressSave ? (
            <>
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`${id}-confirm`}
                  checked={isConfirmed}
                  onCheckedChange={(value) => {
                    setConfirmedKey(value === true ? confirmationKey : null);
                  }}
                />
                <Label
                  htmlFor={`${id}-confirm`}
                  className="text-sm leading-relaxed font-normal"
                >
                  {t("confirm")}
                </Label>
              </div>
              <Button
                type="button"
                disabled={!isConfirmed}
                onClick={() => {
                  if (isConfirmed) onUse(state.address);
                }}
              >
                {t("use")}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("preview")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Do not retain private lookup controls when the selected point is removed. */
export function ReverseAddress(
  props: Parameters<typeof LocatedReverseAddress>[0],
) {
  return props.point ? <LocatedReverseAddress {...props} /> : null;
}
