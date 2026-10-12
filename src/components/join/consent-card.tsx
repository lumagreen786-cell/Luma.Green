"use client";

import { useMutation } from "convex/react";
import { ShieldCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { api } from "../../../convex/_generated/api";
import {
  type ApplicationKind,
  isBusinessKind,
} from "../../../convex/lib/onboarding";

/**
 * Before the first form: what we collect for this role and why, then the
 * 18+ and privacy confirmations (docs/operations/data-protection.md).
 */
export function ConsentCard({ kind }: { kind: ApplicationKind }) {
  const t = useTranslations("join");
  const locale = useLocale();
  const start = useMutation(api.applications.start);
  const [isAdult, setIsAdult] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const why = isBusinessKind(kind) ? "business" : kind;

  async function begin() {
    setIsStarting(true);
    setFailed(false);
    try {
      // The application appears through the live query; the form follows.
      await start({ kind, locale, ageConfirmed: true, privacyAccepted: true });
    } catch {
      setFailed(true);
      setIsStarting(false);
    }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="consent-title">
      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <p className="text-sm font-medium text-primary">
          {t(`roles.${kind}.title`)}
        </p>
        <h1
          id="consent-title"
          className="font-display text-2xl leading-[1.25] font-semibold tracking-tight"
        >
          {t("consent.title")}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {t("consent.lead")}
        </p>
      </header>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 border-s-2 border-primary ps-4">
          <p className="font-medium">{t("youNeed")}</p>
          <p>{t(`roles.${kind}.needs`)}</p>
          <p className="text-muted-foreground">{t(`consent.why.${why}`)}</p>
        </div>
        <p className="flex gap-2 text-sm text-muted-foreground">
          <ShieldCheckIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          {t("consent.privacy")}
        </p>
        <div className="flex flex-col divide-y divide-border border-y border-border">
          <div className="flex items-start gap-3 py-4">
            <Checkbox
              id="consent-age"
              className="mt-0.5 size-5"
              checked={isAdult}
              onCheckedChange={(checked) => {
                setIsAdult(checked === true);
              }}
            />
            <Label htmlFor="consent-age" className="text-base font-normal">
              {t("consent.age")}
            </Label>
          </div>
          <div className="flex items-start gap-3 py-4">
            <Checkbox
              id="consent-read"
              className="mt-0.5 size-5"
              checked={hasRead}
              onCheckedChange={(checked) => {
                setHasRead(checked === true);
              }}
            />
            <Label htmlFor="consent-read" className="text-base font-normal">
              {t("consent.accept")}
            </Label>
          </div>
        </div>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {t("errors.generic")}
          </p>
        ) : null}
        <Button
          size="lg"
          className="h-12 text-base"
          disabled={!isAdult || !hasRead || isStarting}
          onClick={() => {
            void begin();
          }}
        >
          {t(isStarting ? "consent.starting" : "consent.startButton")}
        </Button>
      </div>
    </section>
  );
}
