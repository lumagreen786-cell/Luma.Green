"use client";

import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../../convex/_generated/api";
import {
  FINANCIAL_REFERENCE_MAX,
  FINANCIAL_REFERENCE_MIN,
  PAYMENT_POLICY_VERSION_MAX,
} from "../../../convex/lib/cashfreeLifecycleContract";
import { formatRupees } from "./format";

type FinancialRow = FunctionReturnType<
  typeof api.cashfreeLifecycle.adminList
>["page"][number];
type FeePayer = "buyer" | "seller" | "platform";
type RefundFunder = "seller" | "platform";
function isFeePayer(value: string): value is FeePayer {
  return ["buyer", "seller", "platform"].includes(value);
}

export function PaymentLifecycleSetup() {
  const policy = useQuery(api.cashfreeLifecycle.policyForAdmin, {});
  const [open, setOpen] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [hasSavedPolicy, setHasSavedPolicy] = useState(false);
  return (
    <>
      <section
        className="space-y-4 rounded-xl bg-card p-5 sm:p-6"
        aria-labelledby="payment-policy-title"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h2 id="payment-policy-title" className="text-lg font-semibold">
              Payment terms and activation
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Record the approved business terms before live activation. Saving
              a policy does not enable checkout and does not prove that money
              moved.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setHasSavedPolicy(false);
              setOpen(true);
            }}
          >
            Record approved policy
          </Button>
        </div>
        {policy === undefined ? (
          <Skeleton className="h-12" />
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Server activation</dt>
              <dd>
                {policy.liveEnabled ? "Enabled in server configuration" : "Off"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Selected version</dt>
              <dd className="break-all">
                {policy.configuredVersion ?? "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Approved policy</dt>
              <dd>{policy.policy ? policy.policy.version : "Not available"}</dd>
            </div>
          </dl>
        )}
        <p className="text-sm text-muted-foreground">
          The server must select the saved version. Merchant approval, seller
          verification and provider acceptance remain separate checks. No fee is
          added to an order by this form.
        </p>
        {hasSavedPolicy ? (
          <p role="status" className="text-sm">
            Approved policy recorded. It stays inactive until the server selects
            its version and live activation is approved.
          </p>
        ) : null}
      </section>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!policyBusy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Record approved payment policy</DialogTitle>
            <DialogDescription>
              Use a new version for changed terms. Existing versions and order
              terms cannot be rewritten. Complete these fields from the approved
              provider and business agreement.
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <PolicyForm
              onBusy={setPolicyBusy}
              onSaved={() => {
                setHasSavedPolicy(true);
                setOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <FinancialRecords />
    </>
  );
}

function PolicyForm({
  onSaved,
  onBusy,
}: {
  onSaved: () => void;
  onBusy: (isBusy: boolean) => void;
}) {
  const save = useMutation(api.cashfreeLifecycle.savePolicyForAdmin);
  const [version, setVersion] = useState("");
  const [feePayer, setFeePayer] = useState<FeePayer | "">("");
  const [refundFunder, setRefundFunder] = useState<RefundFunder | "">("");
  const [settlementTermsReference, setSettlementReference] = useState("");
  const [providerAcceptanceReference, setAcceptanceReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit() {
    if (!feePayer || !refundFunder || busy) return;
    setBusy(true);
    onBusy(true);
    setFailed(false);
    try {
      await save({
        version: version.trim(),
        feePayer,
        refundFunder,
        refundAuthority: "platform_admin",
        settlementTermsReference: settlementTermsReference.trim(),
        providerAcceptanceReference: providerAcceptanceReference.trim(),
      });
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="policy-version">Policy version</Label>
        <Input
          id="policy-version"
          required
          minLength={1}
          maxLength={PAYMENT_POLICY_VERSION_MAX}
          pattern="[A-Za-z0-9_-]+"
          value={version}
          disabled={busy}
          onChange={(event) => {
            setVersion(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="policy-fee-payer">Who bears gateway fees?</Label>
        <Select
          value={feePayer}
          disabled={busy}
          onValueChange={(value) => {
            if (isFeePayer(value)) setFeePayer(value);
          }}
        >
          <SelectTrigger id="policy-fee-payer">
            <SelectValue placeholder="Choose the approved party" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buyer">Buyer</SelectItem>
            <SelectItem value="seller">Seller</SelectItem>
            <SelectItem value="platform">Luma</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="policy-refund-funder">Who funds refunds?</Label>
        <Select
          value={refundFunder}
          disabled={busy}
          onValueChange={(value) => {
            if (value === "seller" || value === "platform")
              setRefundFunder(value);
          }}
        >
          <SelectTrigger id="policy-refund-funder">
            <SelectValue placeholder="Choose the approved party" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="seller">Seller</SelectItem>
            <SelectItem value="platform">Luma</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm">
        Refund authority: the platform administrator. This release supports full
        remaining refunds. Partial quantities and quality disputes require
        review.
      </p>
      <div className="space-y-2">
        <Label htmlFor="policy-settlement-reference">
          Approved settlement terms reference
        </Label>
        <Input
          id="policy-settlement-reference"
          required
          minLength={FINANCIAL_REFERENCE_MIN}
          maxLength={FINANCIAL_REFERENCE_MAX}
          value={settlementTermsReference}
          disabled={busy}
          onChange={(event) => {
            setSettlementReference(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="policy-acceptance-reference">
          Provider acceptance test reference
        </Label>
        <Input
          id="policy-acceptance-reference"
          required
          minLength={FINANCIAL_REFERENCE_MIN}
          maxLength={FINANCIAL_REFERENCE_MAX}
          value={providerAcceptanceReference}
          disabled={busy}
          onChange={(event) => {
            setAcceptanceReference(event.target.value);
          }}
        />
      </div>
      <Button type="submit" disabled={busy || !feePayer || !refundFunder}>
        {busy ? "Saving…" : "Save approved version"}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Policy not saved. Check the fields and use a new version for changed
          terms. Your draft is retained.
        </p>
      ) : null}
    </form>
  );
}

function FinancialRecords() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.cashfreeLifecycle.adminList,
    {},
    { initialNumItems: 20 },
  );
  return (
    <section
      className="space-y-4 rounded-xl bg-card p-5 sm:p-6"
      aria-labelledby="financial-records-title"
    >
      <h2 id="financial-records-title" className="text-lg font-semibold">
        Payment, refund and settlement review
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Recheck provider evidence when an order is pending or held. A request is
        not a confirmed refund. Aggregate seller settlement notices do not prove
        settlement for an individual order.
      </p>
      {status === "LoadingFirstPage" ? <Skeleton className="h-20" /> : null}
      {status !== "LoadingFirstPage" && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No financial lifecycle records yet.
        </p>
      ) : null}
      <div className="divide-y">
        {results.map((row) => (
          <FinancialRecord key={row.tradeId} row={row} />
        ))}
      </div>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => {
            loadMore(20);
          }}
        >
          {status === "LoadingMore" ? "Loading…" : "Load more records"}
        </Button>
      ) : null}
    </section>
  );
}

function FinancialRecord({ row }: { row: FinancialRow }) {
  const reconcile = useAction(api.cashfreeLifecycleActions.reconcileForAdmin);
  const refund = useAction(api.cashfreeLifecycleActions.requestRefundForAdmin);
  const [confirming, setConfirming] = useState(false);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  async function run(kind: "reconcile" | "refund") {
    if (
      busy ||
      (kind === "refund" && !row.canRefund) ||
      (kind === "reconcile" && !row.canReconcile)
    )
      return;
    setBusy(true);
    setFailed(false);
    setNotice("");
    try {
      if (kind === "refund")
        await refund({
          tradeId: row.tradeId,
          reference: reference.trim(),
          reason: reason.trim(),
        });
      else await reconcile({ tradeId: row.tradeId });
      setNotice(
        "Request processed. Read the updated evidence status below; do not infer success from this message.",
      );
      setConfirming(false);
      setReference("");
      setReason("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  const prefix = `financial-${row.tradeId}`;
  return (
    <article className="space-y-3 py-4">
      <h3 className="font-medium">
        {row.sellerName} → {row.buyerName}
      </h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-4">
        {(["state", "collection", "settlement", "refund"] as const).map(
          (key) => (
            <div key={key}>
              <dt className="text-muted-foreground capitalize">{key}</dt>
              <dd>{row[key].replaceAll("_", " ")}</dd>
            </div>
          ),
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy || !row.canReconcile}
          onClick={() => {
            void run("reconcile");
          }}
        >
          {busy ? "Working…" : "Recheck provider evidence"}
        </Button>
        {row.canRefund ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setConfirming(true);
            }}
          >
            Request remaining refund
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <form
          className="space-y-3 border-s-2 border-border ps-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run("refund");
          }}
        >
          <p className="text-sm">
            This requests the full remaining refundable amount:{" "}
            {formatRupees(row.refundablePaise)}. Confirm the approved reason and
            reference before sending the request to the provider.
          </p>
          <Label htmlFor={`${prefix}-reference`}>Refund reference</Label>
          <Input
            id={`${prefix}-reference`}
            required
            minLength={FINANCIAL_REFERENCE_MIN}
            maxLength={FINANCIAL_REFERENCE_MAX}
            value={reference}
            disabled={busy}
            onChange={(event) => {
              setReference(event.target.value);
            }}
          />
          <Label htmlFor={`${prefix}-reason`}>Approved refund reason</Label>
          <Input
            id={`${prefix}-reason`}
            required
            minLength={FINANCIAL_REFERENCE_MIN}
            maxLength={FINANCIAL_REFERENCE_MAX}
            value={reason}
            disabled={busy}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !row.canRefund}>
              Confirm refund request
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Go back
            </Button>
          </div>
        </form>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          The request did not complete. Your reference is retained. Recheck
          provider evidence before retrying.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
    </article>
  );
}
