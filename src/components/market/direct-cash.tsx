"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCanOperate } from "@/components/workspace/permissions";

import { api } from "../../../convex/_generated/api";
import {
  FINANCIAL_REFERENCE_MAX,
  FINANCIAL_REFERENCE_MIN,
} from "../../../convex/lib/cashfreeLifecycleContract";
import { DirectCashCustody } from "./direct-cash-custody";
import type { TradeSide, TradeView } from "./types";

export function DirectCash({
  trade,
  side,
  compact,
}: {
  trade: TradeView;
  side: TradeSide;
  compact: boolean;
}) {
  const t = useTranslations("tradeLifecycle");
  const canOperate = useCanOperate();
  const canReport =
    trade.status === "completed" &&
    side === "seller" &&
    canOperate &&
    !compact &&
    !trade.directCashReceipt;
  const canMove =
    !compact &&
    canOperate &&
    ((trade.status === "accepted" && side === "seller") ||
      (trade.status === "dispatched" && side === "buyer"));
  return (
    <section className="flex flex-col gap-2" aria-label={t("collectionLabel")}>
      {trade.directCashReceipt ? (
        <p role="status" className="text-sm font-medium">
          {t("cashReported")}
        </p>
      ) : null}
      {trade.status === "completed" || trade.directCashReceipt ? (
        <p className="text-sm text-muted-foreground">{t("cashNote")}</p>
      ) : null}
      {canReport ? <DirectCashForm trade={trade} /> : null}
      {trade.status === "dispatched" ? (
        <p className="text-sm">{t("state.dispatched")}</p>
      ) : null}
      {trade.status === "completed" ? (
        <p className="text-sm">{t("state.received")}</p>
      ) : null}
      {canMove ? <DirectCashCustody trade={trade} /> : null}
    </section>
  );
}

function DirectCashForm({ trade }: { trade: TradeView }) {
  const t = useTranslations("tradeLifecycle");
  const save = useMutation(api.market.recordDirectCash);
  const field = useId();
  const [reference, setReference] = useState("");
  const [isBusy, setBusy] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const [hasSaved, setSaved] = useState(false);
  const canSubmit =
    !isBusy && !hasSaved && reference.trim().length >= FINANCIAL_REFERENCE_MIN;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setFailed(false);
    try {
      await save({
        tradeId: trade.id,
        amountPaise: trade.totalPaise,
        reference: reference.trim(),
      });
      setSaved(true);
      toast.success(t("saved"));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-foreground">
        {t("cashRecord")}
      </summary>
      <form
        className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Label htmlFor={field}>{t("cashReference")}</Label>
        <Input
          id={field}
          required
          maxLength={FINANCIAL_REFERENCE_MAX}
          value={reference}
          disabled={isBusy || hasSaved}
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
        {hasFailed ? (
          <p role="alert" className="text-sm">
            {t("failed")}
          </p>
        ) : null}
        <ActionButton
          type="submit"
          label={t("confirm")}
          isDisabled={!canSubmit}
          className="self-start"
        />
      </form>
    </details>
  );
}
