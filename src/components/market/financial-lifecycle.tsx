"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCanOperate } from "@/components/workspace/permissions";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  FINANCIAL_REFERENCE_MAX,
  FINANCIAL_REFERENCE_MIN,
} from "../../../convex/lib/cashfreeLifecycleContract";
import { SandboxCheckout } from "./sandbox-checkout";

type Action = "dispatch" | "receive" | "cancel";
type Snapshot = NonNullable<
  FunctionReturnType<typeof api.cashfreeLifecycle.status>
>;

/** Financial evidence is separate from deprecated prototype trade flags. */
export function FinancialLifecycle({
  tradeId,
  compact = false,
  legacyContent,
  actionsOnly = false,
}: {
  tradeId: Id<"trades">;
  compact?: boolean;
  legacyContent?: ReactNode;
  actionsOnly?: boolean;
}) {
  const t = useTranslations("tradeLifecycle");
  const common = useTranslations("common");
  const trades = useTranslations("market.trades");
  const status = useQuery(api.cashfreeLifecycle.status, { tradeId });
  if (actionsOnly) {
    return status?.state === "awaiting_payment" ? (
      <FinancialActions tradeId={tradeId} status={status} />
    ) : null;
  }
  if (status === undefined) return <p role="status">{common("loading")}</p>;
  if (status === null)
    return (
      <>
        {legacyContent ?? (
          <p className="text-sm text-muted-foreground">
            {trades("legacyUnverified")}
          </p>
        )}
      </>
    );
  return (
    <section className="flex flex-col gap-3" aria-label={t("title")}>
      <p role="status" className="text-sm font-medium">
        {t(`state.${status.state}`)}
      </p>
      {compact ? null : <FinancialDetails tradeId={tradeId} status={status} />}
    </section>
  );
}

const evidenceFields = [
  { kind: "collection", label: "collectionLabel" },
  { kind: "settlement", label: "settlementLabel" },
  { kind: "refund", label: "refundLabel" },
] as const;
function FinancialDetails({
  tradeId,
  status,
}: {
  tradeId: Id<"trades">;
  status: Snapshot;
}) {
  const t = useTranslations("tradeLifecycle");
  return (
    <>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        {evidenceFields.map(({ kind, label }) => (
          <div key={kind} className="min-w-0">
            <dt className="text-muted-foreground">{t(label)}</dt>
            <dd>{t(`${kind}.${status[kind]}`)}</dd>
          </div>
        ))}
      </dl>
      {status.policyReady ? null : (
        <p className="text-sm text-muted-foreground">{t("policyMissing")}</p>
      )}
      {status.state === "hold" ? (
        <p role="alert" className="text-sm">
          {t("reviewRequired")}
        </p>
      ) : null}
      {status.state === "awaiting_payment" ? (
        <SandboxCheckout tradeId={tradeId} />
      ) : null}
      <FinancialActions tradeId={tradeId} status={status} />
    </>
  );
}

function FinancialActions({
  tradeId,
  status,
}: {
  tradeId: Id<"trades">;
  status: Snapshot;
}) {
  const t = useTranslations("tradeLifecycle");
  const canOperate = useCanOperate();
  const act = useMutation(api.cashfreeLifecycle.act);
  const cancel = useMutation(api.cashfreeLifecycle.requestCancellation);
  const [action, setAction] = useState<Action | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const allowed = canOperate ? status.actions : [];
  const isActionAllowed = action !== null && allowed.includes(action);
  async function submit() {
    if (
      !action ||
      !isActionAllowed ||
      busy ||
      reference.trim().length < FINANCIAL_REFERENCE_MIN
    )
      return;
    setBusy(true);
    setFailed(false);
    try {
      if (action === "cancel")
        await cancel({ tradeId, reason: reference.trim() });
      else await act({ tradeId, action, reference: reference.trim() });
      setAction(null);
      setReference("");
      toast.success(t("saved"));
    } catch {
      setFailed(true);
      toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  }
  function dismiss() {
    setAction(null);
    setReference("");
    setFailed(false);
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {allowed.map((value) => (
          <Button
            key={value}
            variant="outline"
            disabled={busy}
            onClick={() => {
              setAction(value);
              setFailed(false);
            }}
          >
            {t(`action.${value}`)}
          </Button>
        ))}
      </div>
      {action ? (
        <ActionForm
          action={action}
          grams={status.grams}
          reference={reference}
          setReference={setReference}
          isAllowed={isActionAllowed}
          isBusy={busy}
          hasFailed={failed}
          submit={submit}
          dismiss={dismiss}
        />
      ) : null}
    </>
  );
}

function ActionForm({
  action,
  grams,
  reference,
  setReference,
  isAllowed,
  isBusy,
  hasFailed,
  submit,
  dismiss,
}: {
  action: Action;
  grams: number;
  reference: string;
  setReference: (value: string) => void;
  isAllowed: boolean;
  isBusy: boolean;
  hasFailed: boolean;
  submit: () => Promise<void>;
  dismiss: () => void;
}) {
  const t = useTranslations("tradeLifecycle");
  const common = useTranslations("common");
  const format = useFormat();
  const id = useId();
  return (
    <form
      className="flex flex-col gap-3 border-s-2 border-border ps-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm">
        {action === "cancel"
          ? t("cancelNote")
          : t("fullQuantity", { weight: format.weight(grams) })}
      </p>
      <Label htmlFor={id}>
        {t(action === "cancel" ? "reason" : "reference")}
      </Label>
      <Input
        id={id}
        required
        minLength={FINANCIAL_REFERENCE_MIN}
        maxLength={FINANCIAL_REFERENCE_MAX}
        value={reference}
        disabled={isBusy}
        onChange={(event) => {
          setReference(event.target.value);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            isBusy ||
            !isAllowed ||
            reference.trim().length < FINANCIAL_REFERENCE_MIN
          }
        >
          {isBusy ? common("loading") : t("confirm")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isBusy}
          onClick={dismiss}
        >
          {t("back")}
        </Button>
      </div>
      {isAllowed ? null : <p role="alert">{t("actionUnavailable")}</p>}
      {hasFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("failed")}
        </p>
      ) : null}
    </form>
  );
}
