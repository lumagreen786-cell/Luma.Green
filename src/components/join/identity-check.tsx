"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ActionButton } from "@/components/ui/action-button";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export interface GstDetails {
  gstin: string;
  businessName: string;
  legalName: string;
  address: string;
}
type Status =
  "verified" | "limit" | "unavailable" | "required" | "pending" | "saveFailed";
function errorStatus(error: unknown): Status {
  if (!(error instanceof ConvexError)) return "unavailable";
  const data: unknown = error.data;
  const code =
    typeof data === "object" && data !== null && "code" in data
      ? data.code
      : data;
  switch (code) {
    case "CHECK_LIMIT": {
      return "limit";
    }
    case "CHECK_PENDING": {
      return "pending";
    }
    case "VALIDATION_REQUIRED": {
      return "required";
    }
    default: {
      return "unavailable";
    }
  }
}

/** Metadata comes only from the owned saved GST lookup, never from client guesses. */
export function IdentityCheck({
  applicationId,
  gstin,
  save,
  onConfirmed,
}: {
  applicationId: Id<"applications">;
  gstin: string | undefined;
  save: () => Promise<unknown>;
  onConfirmed?: (details: GstDetails, isRestored?: boolean) => void;
}) {
  const t = useTranslations("join.identity");
  const labels = useTranslations("join.business");
  const lookup = useAction(api.identityChecks.lookupGst);
  const confirm = useMutation(api.identityChecks.confirmGst);
  const saved = useQuery(api.identityChecks.gst, { applicationId });
  const mirrored = useRef<string | null>(null);
  const [busy, setBusy] = useState<"lookup" | "confirm" | null>(null);
  const running = useRef(false);
  const [result, setResult] = useState<{ key: string; status: Status }>();
  const [details, setDetails] = useState<GstDetails>();
  const key = gstin?.trim().toUpperCase() ?? "";
  const cached = saved?.gstin === key ? saved : undefined;
  const current = details?.gstin === key ? details : cached;
  useEffect(() => {
    if (!cached?.confirmed || mirrored.current === key) return;
    mirrored.current = key;
    onConfirmed?.(cached, true);
  }, [cached, key, onConfirmed]);
  let status = result?.key === key ? result.status : undefined;
  if (cached?.confirmed) status = "verified";
  if (!key) return null;

  async function check() {
    if (running.current) return;
    running.current = true;
    setBusy("lookup");
    setResult(undefined);
    setDetails(undefined);
    let isSaved = false;
    try {
      await save();
      isSaved = true;
      const found = await lookup({ applicationId, consent: true });
      if (found.gstin !== key) throw new ConvexError("VALIDATION_REQUIRED");
      setDetails(found);
    } catch (error) {
      setResult({ key, status: isSaved ? errorStatus(error) : "saveFailed" });
    } finally {
      running.current = false;
      setBusy(null);
    }
  }
  async function confirmBusiness() {
    if (!current || running.current) return;
    running.current = true;
    setBusy("confirm");
    setResult(undefined);
    try {
      await confirm({ applicationId, gstin: current.gstin });
      setResult({ key, status: "verified" });
      mirrored.current = key;
      onConfirmed?.(current);
    } catch (error) {
      setResult({ key, status: errorStatus(error) });
    } finally {
      running.current = false;
      setBusy(null);
    }
  }
  return (
    <section
      className="space-y-3 border-t border-border pt-4"
      aria-label={t("check")}
    >
      <p className="text-sm text-muted-foreground">{t("disclosure")}</p>
      <ActionButton
        type="button"
        label={t(busy === "lookup" ? "checking" : "check")}
        isDisabled={busy !== null}
        onClick={() => {
          void check();
        }}
      />
      {current ? (
        <div className="space-y-3 border-s-2 border-border ps-4">
          <h3 className="font-medium">{t("previewTitle")}</h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">
                {labels("businessName")}
              </dt>
              <dd className="break-words">{current.businessName}</dd>
              {current.legalName === current.businessName ? null : (
                <dd className="break-words">{current.legalName}</dd>
              )}
            </div>
            <div>
              <dt className="text-muted-foreground">{labels("address")}</dt>
              <dd className="break-words whitespace-pre-line">
                {current.address}
              </dd>
            </div>
          </dl>
          <ActionButton
            type="button"
            label={t(busy === "confirm" ? "confirming" : "confirm")}
            isDisabled={
              busy !== null ||
              cached?.confirmed === true ||
              (result?.key === key && result.status === "verified")
            }
            onClick={() => {
              void confirmBusiness();
            }}
          />
        </div>
      ) : null}
      <p role="status" className="text-sm" aria-live="polite">
        {status ? t(status) : null}
      </p>
    </section>
  );
}
