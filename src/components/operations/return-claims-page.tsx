"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ClipboardListIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import {
  AppPageHeader,
  ListSkeleton,
  Section,
} from "@/components/app/page-parts";
import { useWorkspace } from "@/components/app/use-workspace";
import { LotField, Mass } from "@/components/lots/form-parts";
import { parseGrams } from "@/components/lots/logic";
import { NotForYou, QueryBoundary } from "@/components/shop/guards";
import { ActionButton } from "@/components/ui/action-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ReturnRow = FunctionReturnType<typeof api.returns.mine>["rows"][number];
type ClaimRow = FunctionReturnType<
  typeof api.schemeClaims.mine
>["rows"][number];
type Option = FunctionReturnType<typeof api.returns.options>[number];
function useEvidenceSave() {
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);
  async function save(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }
  return { busy, save };
}

export function ReturnClaimsPage() {
  const workspace = useWorkspace();
  const session = authClient.useSession();
  const t = useTranslations();
  if (workspace === undefined) return <ListSkeleton />;
  if (workspace?.kind !== "org")
    return (
      <NotForYou
        title={t("returnClaims.title")}
        icon={ClipboardListIcon}
        heading={t("returnClaims.title")}
        body={t("qualityDocuments.businessRequired")}
      />
    );
  if (!session.data?.user.id) return <ListSkeleton />;
  return (
    <QueryBoundary key={`${session.data.user.id}:${workspace.org.id}`}>
      <ReturnClaimsBody
        orgId={workspace.org.id}
        canManage={workspace.role === "owner" || workspace.role === "admin"}
        canOperate={workspace.role !== "viewer"}
      />
    </QueryBoundary>
  );
}
function ReturnClaimsBody({
  orgId,
  canManage,
  canOperate,
}: {
  orgId: Id<"orgs">;
  canManage: boolean;
  canOperate: boolean;
}) {
  const t = useTranslations();
  const options = useQuery(api.returns.options),
    returns = useQuery(api.returns.mine),
    claims = useQuery(api.schemeClaims.mine);
  if (!options || !returns || !claims) return <ListSkeleton />;
  return (
    <div className="flex flex-col gap-6">
      <AppPageHeader
        title={t("returnClaims.title")}
        lead={t("returnClaims.notice")}
      />
      <Section title={t("returnClaims.returnTitle")}>
        {canOperate ? (
          <ProposeReturn
            options={options.filter((option) => option.canReturn)}
          />
        ) : null}
        <ul className="divide-y border-y">
          {returns.rows.map((row) => (
            <li key={row.id}>
              <ReturnRecord
                row={row}
                orgId={orgId}
                canManage={canManage}
                canOperate={canOperate}
              />
            </li>
          ))}
        </ul>
        {returns.rows.length === 0 ? (
          <p>{t("qualityDocuments.empty")}</p>
        ) : null}
        {returns.hasMore ? <p>{t("lots.limit")}</p> : null}
      </Section>
      <Section title={t("returnClaims.scheme")}>
        {canManage ? (
          <DeclareClaim options={options.filter((row) => row.canClaim)} />
        ) : null}
        <ul className="divide-y border-y">
          {claims.rows.map((row) => (
            <li key={row.id}>
              <ClaimRecord row={row} canManage={canManage} />
            </li>
          ))}
        </ul>
        {claims.rows.length === 0 ? <p>{t("qualityDocuments.empty")}</p> : null}
        {claims.hasMore ? <p>{t("lots.limit")}</p> : null}
      </Section>
    </div>
  );
}
function SourcePicker({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-2">
      <Label>{t("market.trades.title")}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11" aria-label={t("market.trades.title")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((row) => (
            <SelectItem key={row.tradeId} value={row.tradeId}>
              {row.materialCode} · {row.sellerName} · {row.buyerName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function ProposeReturn({ options }: { options: Option[] }) {
  const t = useTranslations();
  const propose = useMutation(api.returns.propose);
  const { busy, save } = useEvidenceSave();
  const [source, setSource] = useState(""),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [freightPayer, setFreight] = useState<"buyer" | "seller">("buyer");
  const chosen = options.find((row) => row.tradeId === source);
  if (options.length === 0) return <p>{t("qualityDocuments.empty")}</p>;
  return (
    <form
      className="flex flex-col gap-4 border-b pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen)
          void save(() =>
            propose({
              tradeId: chosen.tradeId,
              destinationOrgId: chosen.sellerOrgId,
              reference,
              reason,
              freightPayer,
            }),
          );
      }}
    >
      <SourcePicker options={options} value={source} onChange={setSource} />
      {chosen ? (
        <p>
          {t("market.receipt.seller")}: {chosen.sellerName} ·{" "}
          <Mass grams={chosen.grams} />
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <LotField
          label={t("sourcing.reference")}
          value={reference}
          required
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
        <LotField
          label={t("tradeLifecycle.reason")}
          value={reason}
          required
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("returnClaims.freight")}</Label>
        <Select
          value={freightPayer}
          onValueChange={(value) => {
            setFreight(value === "seller" ? "seller" : "buyer");
          }}
        >
          <SelectTrigger
            className="h-11"
            aria-label={t("returnClaims.freight")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buyer">{t("market.receipt.buyer")}</SelectItem>
            <SelectItem value="seller">{t("market.receipt.seller")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ActionButton
        type="submit"
        label={t("returnClaims.returnTitle")}
        isDisabled={busy || !chosen || !reference.trim() || !reason.trim()}
      />
    </form>
  );
}
function RecordLine({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3 py-3">{children}</div>;
}
function ReturnRecord({
  row,
  orgId,
  canManage,
  canOperate,
}: {
  row: ReturnRow;
  orgId: Id<"orgs">;
  canManage: boolean;
  canOperate: boolean;
}) {
  const t = useTranslations();
  const review = useMutation(api.returns.review),
    dispatch = useMutation(api.returns.dispatch),
    receive = useMutation(api.returns.receive),
    reconcile = useMutation(api.returns.reconcile);
  const { busy, save } = useEvidenceSave();
  const [reference, setReference] = useState(""),
    [grams, setGrams] = useState(String(row.grams)),
    [reason, setReason] = useState("");
  const status = {
    proposed: "sourcing.pending",
    rejected: "qualityDocuments.rejected",
    approved: "market.trades.steps.accepted",
    in_transit: "lots.in_transit",
    received: "lots.received",
    reconciled: "shop.requests.tabs.done",
  } as const;
  const canDispatch =
      canOperate && orgId === row.buyerOrgId && row.status === "approved",
    canReceive =
      canOperate &&
      orgId === row.destinationOrgId &&
      row.status === "in_transit";
  return (
    <div className="flex flex-col gap-3 py-4">
      <p className="font-medium">
        {row.reference} · {row.materialCode} · <Mass grams={row.grams} />
      </p>
      <p>
        {t(status[row.status])} · {row.reason}
      </p>
      <p>
        {t("returnClaims.freight")}: {t(`market.receipt.${row.freightPayer}`)}
      </p>
      {canManage &&
      row.status === "proposed" &&
      orgId !== row.proposedByOrgId ? (
        <>
          <LotField
            label={t("tradeLifecycle.reason")}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <RecordLine>
            <ActionButton
              label={t("shop.requests.accept")}
              isDisabled={busy}
              onClick={() =>
                void save(() => review({ returnId: row.id, accept: true }))
              }
            />
            <ActionButton
              label={t("shop.requests.decline")}
              variant="secondary"
              isDisabled={busy || !reason.trim()}
              onClick={() =>
                void save(() =>
                  review({
                    returnId: row.id,
                    accept: false,
                    rejectionReason: reason,
                  }),
                )
              }
            />
          </RecordLine>
        </>
      ) : null}
      {canDispatch || canReceive ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = parseGrams(grams);
            if (amount !== null)
              void save(() =>
                canDispatch
                  ? dispatch({ returnId: row.id, reference, grams: amount })
                  : receive({ returnId: row.id, reference, grams: amount }),
              );
          }}
        >
          <LotField
            label={t("sourcing.reference")}
            value={reference}
            required
            onChange={(event) => {
              setReference(event.target.value);
            }}
          />
          <LotField
            label={t("lots.mass")}
            value={grams}
            inputMode="numeric"
            required
            onChange={(event) => {
              setGrams(event.target.value);
            }}
          />
          <ActionButton
            type="submit"
            label={t(canDispatch ? "lots.dispatch" : "lots.receive")}
            isDisabled={
              busy || !reference.trim() || parseGrams(grams) !== row.grams
            }
          />
        </form>
      ) : null}
      {row.status === "received" ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t("returnClaims.waiting")}
          </p>
          {canManage ? (
            <ActionButton
              label={t("returnClaims.reconcile")}
              isDisabled={busy || !row.isMoneyReconciled}
              onClick={() => void save(() => reconcile({ returnId: row.id }))}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
function DeclareClaim({ options }: { options: Option[] }) {
  const t = useTranslations();
  const declare = useMutation(api.schemeClaims.declare);
  const { busy, save } = useEvidenceSave();
  const [source, setSource] = useState(""),
    [scheme, setScheme] = useState(""),
    [issuer, setIssuer] = useState(""),
    [reference, setReference] = useState(""),
    [grams, setGrams] = useState("");
  const chosen = options.find((row) => row.tradeId === source);
  if (options.length === 0) return <p>{t("qualityDocuments.empty")}</p>;
  return (
    <form
      className="flex flex-col gap-4 border-b pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = parseGrams(grams);
        if (chosen && amount)
          void save(() =>
            declare({
              sourceTradeId: chosen.tradeId,
              schemeReference: scheme,
              issuerReference: issuer,
              operationReference: reference,
              grams: amount,
            }),
          );
      }}
    >
      <SourcePicker options={options} value={source} onChange={setSource} />
      <div className="grid gap-4 sm:grid-cols-2">
        <LotField
          label={t("returnClaims.scheme")}
          value={scheme}
          required
          onChange={(event) => {
            setScheme(event.target.value);
          }}
        />
        <LotField
          label={t("returnClaims.issuer")}
          value={issuer}
          required
          onChange={(event) => {
            setIssuer(event.target.value);
          }}
        />
        <LotField
          label={t("sourcing.reference")}
          value={reference}
          required
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
        <LotField
          label={t("lots.mass")}
          value={grams}
          inputMode="numeric"
          required
          onChange={(event) => {
            setGrams(event.target.value);
          }}
        />
      </div>
      <ActionButton
        type="submit"
        label={t("lots.save")}
        isDisabled={
          busy ||
          !chosen ||
          !scheme.trim() ||
          !issuer.trim() ||
          !reference.trim() ||
          !parseGrams(grams)
        }
      />
    </form>
  );
}
function ClaimRecord({
  row,
  canManage,
}: {
  row: ClaimRow;
  canManage: boolean;
}) {
  const t = useTranslations();
  const withdraw = useMutation(api.schemeClaims.withdrawDeclaration),
    validate = useMutation(api.schemeClaims.validate);
  const { busy, save } = useEvidenceSave();
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-3 py-4">
      <p className="font-medium">
        {row.schemeReference} · <Mass grams={row.grams} />
      </p>
      <p>
        {row.issuerReference} · {row.operationReference}
      </p>
      <p>
        {t(
          row.effectiveStatus === "withdrawn"
            ? "market.sell.mine.withdrawn"
            : "returnClaims.notice",
        )}
      </p>
      {row.withdrawalReason ? <p>{row.withdrawalReason}</p> : null}
      {canManage && row.status === "declared" ? (
        <>
          <LotField
            label={t("tradeLifecycle.reason")}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <RecordLine>
            <ActionButton
              label={t("returnClaims.validate")}
              isDisabled={busy}
              onClick={() =>
                void save(() => validate({ allocationId: row.id }))
              }
            />
            <ActionButton
              label={t("market.sell.mine.withdraw")}
              variant="secondary"
              isDisabled={busy || !reason.trim()}
              onClick={() =>
                void save(() => withdraw({ allocationId: row.id, reason }))
              }
            />
          </RecordLine>
        </>
      ) : null}
    </div>
  );
}
