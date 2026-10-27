"use client";

import { useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { api } from "../../../convex/_generated/api";
import {
  type ApplicationKind,
  isBusinessKind,
} from "../../../convex/lib/onboarding";
import type { Application } from "./use-mine";

/** First registration field and explicit consent share one compact form. */
export function ConsentCard({
  kind,
  onStarting,
  onComplete,
}: {
  kind: ApplicationKind;
  onStarting?: () => void;
  onComplete?: (
    draft: Partial<Pick<Application, "business" | "kabadiwala" | "saathi">>,
  ) => void;
}) {
  const t = useTranslations("join");
  const auth = useTranslations("auth");
  const locale = useLocale();
  const start = useMutation(api.applications.start);
  const save = useMutation(api.applications.saveDraft);
  const [value, setValue] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const isBusiness = isBusinessKind(kind);
  const isValid =
    isBusiness || (value.trim().length >= 2 && value.trim().length <= 80);
  let fieldKey = "kabadiwala.ownerName";
  if (isBusiness) fieldKey = "form.gstin";
  else if (kind === "saathi") fieldKey = "saathi.name";
  const fieldLabel = t(fieldKey);
  async function begin() {
    if (!isValid || !isAdult || !hasRead || pending.current) return;
    pending.current = true;
    setIsStarting(true);
    setFailed(false);
    onStarting?.();
    try {
      const applicationId = await start({
        kind,
        locale,
        ageConfirmed: true,
        privacyAccepted: true,
      });
      const first: Partial<
        Pick<Application, "business" | "kabadiwala" | "saathi">
      > = {};
      if (isBusiness) first.business = { gstRegistered: true };
      else if (kind === "saathi") first.saathi = { name: value.trim() };
      else first.kabadiwala = { ownerName: value.trim() };
      await save({ applicationId, ...first });
      onComplete?.(first);
    } catch {
      setFailed(true);
      setIsStarting(false);
      pending.current = false;
    }
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void begin();
      }}
    >
      <h1 className="font-display text-2xl leading-tight font-semibold">
        {t(`roles.${kind}.title`)}
      </h1>
      {isBusiness ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="registration-first">{fieldLabel}</Label>
          <Input
            id="registration-first"
            value={value}
            maxLength={80}
            autoComplete="name"
            autoCapitalize="words"
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t("consent.privacy")}</p>
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="consent-age"
          className="min-h-11 cursor-pointer items-start gap-3 py-2 text-base font-normal"
        >
          <Checkbox
            id="consent-age"
            className="mt-0.5 size-5"
            checked={isAdult}
            onCheckedChange={(checked) => {
              setIsAdult(checked === true);
            }}
          />
          <span>{t("consent.age")}</span>
        </Label>
        <Label
          htmlFor="consent-read"
          className="min-h-11 cursor-pointer items-start gap-3 py-2 text-base font-normal"
        >
          <Checkbox
            id="consent-read"
            className="mt-0.5 size-5"
            checked={hasRead}
            onCheckedChange={(checked) => {
              setHasRead(checked === true);
            }}
          />
          <span>{t("consent.accept")}</span>
        </Label>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.generic")}
        </p>
      ) : null}
      <ActionButton
        type="submit"
        label={isStarting ? t("consent.starting") : auth("continue")}
        isDisabled={!isValid || !isAdult || !hasRead || isStarting}
        className="w-full"
      />
      <details className="border-t pt-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
          {t("youNeed")}
        </summary>
        <p className="text-sm text-muted-foreground">
          {t(`roles.${kind}.needs`)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(`consent.why.${isBusiness ? "business" : kind}`)}
        </p>
      </details>
    </form>
  );
}
