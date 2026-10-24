"use client";

import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ActionButton } from "@/components/ui/action-button";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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

/** The action reads the saved draft; no identity values enter action arguments. */
export function IdentityCheck({
  applicationId,
  pan,
  gstin,
  save,
}: {
  applicationId: Id<"applications">;
  pan: string | undefined;
  gstin: string | undefined;
  save: () => Promise<unknown>;
}) {
  const t = useTranslations("join.identity");
  const verify = useAction(api.identityChecks.verify);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [result, setResult] = useState<{ key: string; status: Status }>();
  const key = JSON.stringify([
    pan?.trim().toUpperCase() ?? "",
    gstin?.trim().toUpperCase() ?? "",
  ]);
  if (!pan?.trim() && !gstin?.trim()) return null;

  async function check() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setResult(undefined);
    let isSaved = false;
    try {
      await save();
      isSaved = true;
      await verify({ applicationId, consent: true });
      setResult({ key, status: "verified" });
    } catch (error) {
      setResult({ key, status: isSaved ? errorStatus(error) : "saveFailed" });
    } finally {
      running.current = false;
      setBusy(false);
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
        label={t(busy ? "checking" : "check")}
        isDisabled={busy}
        onClick={() => {
          void check();
        }}
      />
      <p role="status" className="text-sm" aria-live="polite">
        {result?.key === key ? t(result.status) : null}
      </p>
    </section>
  );
}
