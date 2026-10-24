"use client";

import { ArrowRightIcon, MessageSquareWarningIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { normalizeIndianMobile } from "../../../convex/lib/phone";
import { SaveIndicator } from "./fields";
import type { SubmitFailure } from "./submit-error";
import type { SaveState } from "./use-autosave";

/** Role, title, step and the save state, at the top of every form. */
export function FormHeader({
  eyebrow,
  title,
  saveState,
  step,
}: {
  eyebrow: string;
  title: string;
  saveState: SaveState;
  step?: string;
}) {
  return (
    <header className="grid gap-3 border-b border-border pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0 space-y-2">
        <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {eyebrow}
          {step ? <span> · {step}</span> : null}
        </p>
      </div>
      <SaveIndicator state={saveState} />
    </header>
  );
}

/** The admin's note when they've asked for changes. */
export function ChangesNote({ note }: { note: string | undefined }) {
  const t = useTranslations("join.form");
  if (!note) return null;
  return (
    <Alert>
      <MessageSquareWarningIcon aria-hidden />
      <AlertTitle>{t("changesTitle")}</AlertTitle>
      <AlertDescription className="whitespace-pre-line">
        {note}
      </AlertDescription>
    </Alert>
  );
}

/** The form's last row: what went wrong (if anything) and the main button. */
export function SubmitBar({
  label,
  busyLabel,
  isBusy,
  failure,
  secondary,
}: {
  label: string;
  busyLabel: string;
  isBusy: boolean;
  failure: SubmitFailure | null;
  secondary?: ReactNode;
}) {
  const t = useTranslations("join");
  const failureKeys = {
    identity: "identity.required",
    fixErrors: "form.fixErrors",
    generic: "errors.generic",
  } as const;
  return (
    <div className="flex flex-col gap-4 border-t border-border bg-background pt-6">
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {t(failureKeys[failure])}
        </p>
      ) : null}
      <ActionButton
        type="submit"
        className="w-full"
        label={isBusy ? busyLabel : label}
        isDisabled={isBusy}
        endContent={
          <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
        }
      />
      {secondary}
    </div>
  );
}

/** Extra numbers as the draft keeps them: E.164 once they're valid. */
export function cleanPhones(
  phones: readonly { number: string; label: string }[] | undefined,
) {
  return (phones ?? []).map((phone) => ({
    number: normalizeIndianMobile(phone.number) ?? phone.number,
    label: phone.label,
  }));
}

/** GSTIN as stored: uppercase, trimmed, and only if they said they have one. */
export function cleanGstin(
  gstRegistered: boolean | undefined,
  gstin: string | undefined,
): string | undefined {
  return gstRegistered ? gstin?.trim().toUpperCase() : undefined;
}
