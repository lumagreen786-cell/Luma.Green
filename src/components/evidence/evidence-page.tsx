"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FileTextIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { EvidenceDialog, LotField } from "@/components/lots/form-parts";
import { NotForYou } from "@/components/shop/guards";
import { useBusiness } from "@/components/shop/use-shop";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCanOperate } from "@/components/workspace/permissions";
import { isLocale, localeDirection } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import {
  evidencePreparationCsv,
  evidencePreparationExport,
} from "@/lib/evidence-preparation-export";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cleanEvidenceText } from "../../../convex/lib/commercialEvidence";

type Evidence = FunctionReturnType<
  typeof api.commercialEvidence.mine
>["page"][number];
const kinds = [
  "gst_invoice",
  "eway_bill",
  "cpcb_epr_certificate",
  "pollution_consent",
] as const;
const issuers = [
  "external_authority",
  "external_organization",
  "trade_seller",
  "trade_buyer",
] as const;

export function EvidencePage() {
  const business = useBusiness();
  const t = useTranslations("evidence");
  const workspace = useTranslations("workspace");
  if (business === undefined) return <ListSkeleton />;
  if (!business)
    return (
      <NotForYou
        title={t("title")}
        heading={t("title")}
        body={workspace("empty")}
        icon={FileTextIcon}
      />
    );
  return <EvidenceHistory key={business.id} orgId={business.id} />;
}

function EvidenceHistory({ orgId }: { orgId: Id<"orgs"> }) {
  const t = useTranslations("evidence");
  const lots = useTranslations("lots");
  const inbox = useTranslations("notifications");
  const common = useTranslations("common");
  const format = useFormatter();
  const canOperate = useCanOperate();
  const { results, status, loadMore } = usePaginatedQuery(
    api.commercialEvidence.mine,
    { expectedOrgId: orgId },
    { initialNumItems: 20 },
  );
  const replaced = new Set(
    results.flatMap((row) => (row.supersedesId ? [row.supersedesId] : [])),
  );
  return (
    <div className="flex flex-col gap-6">
      <AppPageHeader
        title={t("title")}
        lead={t("lead")}
        actions={canOperate ? <ReferenceForm /> : undefined}
      />
      <section className="space-y-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">{t("export.notice")}</p>
        <div className="flex flex-wrap gap-2">
          {(["csv", "json"] as const).map((kind) => (
            <ActionButton
              key={kind}
              label={t(kind === "csv" ? "export.download" : "export.json")}
              isDisabled={
                status === "LoadingFirstPage" ||
                status === "LoadingMore" ||
                results.some((row) => row.orgId !== orgId)
              }
              onClick={() => {
                let url: string | undefined;
                try {
                  const input = {
                    orgId,
                    generatedAt: Date.now(),
                    complete: status === "Exhausted",
                    references: results,
                  };
                  const content =
                    kind === "csv"
                      ? evidencePreparationCsv(input)
                      : evidencePreparationExport(input);
                  url = URL.createObjectURL(
                    new Blob([content], {
                      type:
                        kind === "csv"
                          ? "text/csv;charset=utf-8"
                          : "application/json",
                    }),
                  );
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = `luma-unfiled-evidence.${kind}`;
                  anchor.click();
                } catch {
                  toast.error(common("error"));
                } finally {
                  if (url) URL.revokeObjectURL(url);
                }
              }}
            />
          ))}
        </div>
        <p className="text-sm">
          {t(status === "Exhausted" ? "export.complete" : "export.partial")}
        </p>
      </section>
      {canOperate ? null : (
        <p className="text-sm text-muted-foreground">{lots("readOnly")}</p>
      )}
      {status === "LoadingFirstPage" ? (
        <ListSkeleton />
      ) : (
        <ul className="divide-y border-y">
          {results.map((row) => (
            <li
              key={row.id}
              className="flex min-w-0 flex-col gap-3 py-5 sm:flex-row sm:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <h2 className="font-medium break-words">{row.reference}</h2>
                <p className="text-sm">
                  {t(row.kind)} · {row.issuerName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("unverified")} ·{" "}
                  {format.dateTime(row.createdAt, { dateStyle: "medium" })}
                </p>
                {row.supersedesId ? (
                  <p className="text-sm">
                    {t("replacement", {
                      reference:
                        results.find((item) => item.id === row.supersedesId)
                          ?.reference ?? row.supersedesId,
                    })}
                  </p>
                ) : null}
                {row.tradeId ? (
                  <Link
                    className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                    href="/app/trades"
                  >
                    {t("trade")}
                  </Link>
                ) : null}
              </div>
              {canOperate && !replaced.has(row.id) ? (
                <div className="shrink-0">
                  <ReferenceForm previous={row} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {status === "Exhausted" && results.length === 0 ? (
        <p className="text-muted-foreground">{lots("empty")}</p>
      ) : null}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={status === "LoadingMore"}
          onClick={() => {
            loadMore(20);
          }}
        >
          {status === "LoadingMore" ? common("loading") : inbox("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

function Picker({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const locale = useLocale();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
      >
        <SelectTrigger id={id} className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ReferenceForm({ previous }: { previous?: Evidence }) {
  const t = useTranslations("evidence");
  const lots = useTranslations("lots");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Evidence["kind"]>(
    previous?.kind ?? "gst_invoice",
  );
  const [issuerKind, setIssuerKind] = useState<Evidence["issuerKind"]>(
    previous?.issuerKind ?? "external_organization",
  );
  const [reference, setReference] = useState("");
  const [issuerName, setIssuerName] = useState(previous?.issuerName ?? "");
  const [tradeId, setTradeId] = useState<Id<"trades"> | undefined>(
    previous?.tradeId,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const save = useMutation(api.commercialEvidence.recordExternal);
  const trades = useQuery(api.market.trades, open && !previous ? {} : "skip");
  const choices = [...(trades?.buying ?? []), ...(trades?.selling ?? [])];
  const isExternal =
    issuerKind === "external_authority" ||
    issuerKind === "external_organization";
  async function submit() {
    if (busy) return;
    if (
      !cleanEvidenceText(reference, 120) ||
      (isExternal && !cleanEvidenceText(issuerName, 120))
    ) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await save({
        kind,
        reference: reference.trim(),
        issuerKind,
        issuerName: isExternal ? issuerName.trim() : undefined,
        tradeId,
        supersedesId: previous?.id,
      });
      setReference("");
      setOpen(false);
      toast.success(lots("saved"));
    } catch {
      setError(true);
      toast.error(common("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <EvidenceDialog
      title={t(previous ? "correct" : "record")}
      hint={t(previous ? "correctionHint" : "lead")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        if (!busy) setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
          {previous ? (
            <p className="text-sm break-words">
              {t("replacement", { reference: previous.reference })}
            </p>
          ) : null}
          <Picker
            label={t("kind")}
            value={kind}
            disabled={Boolean(previous)}
            options={kinds.map((value) => ({ value, label: t(value) }))}
            onChange={(value) => {
              const found = kinds.find((item) => item === value);
              if (found) setKind(found);
            }}
          />
          {previous ? null : (
            <Picker
              label={t("trade")}
              value={tradeId ?? "none"}
              options={[
                { value: "none", label: t("none") },
                ...choices.map((trade) => ({
                  value: trade.id,
                  label: `${trade.counterparty.name} · ${trade.material.code} · ${trade.id.slice(-6)}`,
                })),
              ]}
              onChange={(value) => {
                const found = choices.find((item) => item.id === value);
                setTradeId(found?.id);
                if (!found && !isExternal)
                  setIssuerKind("external_organization");
              }}
            />
          )}
          <Picker
            label={t("issuer")}
            value={issuerKind}
            options={issuers
              .filter(
                (value) => Boolean(tradeId) || !value.startsWith("trade_"),
              )
              .map((value) => ({ value, label: t(value) }))}
            onChange={(value) => {
              const found = issuers.find((item) => item === value);
              if (found) setIssuerKind(found);
            }}
          />
          {isExternal ? (
            <LotField
              label={t("issuerName")}
              value={issuerName}
              onChange={(event) => {
                setIssuerName(event.target.value);
              }}
              required
              maxLength={120}
            />
          ) : null}
          <LotField
            label={t("reference")}
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
            }}
            required
            maxLength={120}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {lots("genericError")}
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="self-start">
            {lots(busy ? "saving" : "save")}
          </Button>
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}
