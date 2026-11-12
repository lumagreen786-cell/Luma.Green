"use client";

import { ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { EmptyState, Section, StatusPill } from "@/components/app/page-parts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { Receipt } from "./types";
import { useLongDate } from "./use-long-date";

export function invoicePath(receipt: Pick<Receipt, "tradeId">): string {
  return `/app/trades/${receipt.tradeId}/invoice`;
}

function InvoiceLink({
  receipt,
  className,
}: {
  receipt: Receipt;
  className?: string;
}) {
  const t = useTranslations("compliance.receipts");
  return (
    <Link
      href={invoicePath(receipt)}
      aria-label={t("view", { number: receipt.legacyReceiptNo })}
      className={cn(
        "rounded font-mono text-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {receipt.legacyReceiptNo}
    </Link>
  );
}

function EwayPill({ receipt, long }: { receipt: Receipt; long?: boolean }) {
  const t = useTranslations("compliance.receipts");
  const needed = t(long ? "ewayNeededLong" : "ewayNeeded");
  const notNeeded = t(long ? "ewayNotNeededLong" : "ewayNotNeeded");
  return (
    <StatusPill tone={receipt.needsEwayBill ? "warn" : "neutral"}>
      {receipt.needsEwayBill ? needed : notNeeded}
    </StatusPill>
  );
}

/** The other business and which way the goods went. */
function useParty() {
  const t = useTranslations("compliance.receipts");
  return (receipt: Receipt) => ({
    side: t(receipt.side),
    name: receipt.counterparty?.name ?? t("unknown"),
  });
}

/** Phones: one card per invoice, the whole card a link to it. */
function ReceiptCards({ receipts }: { receipts: Receipt[] }) {
  const t = useTranslations("compliance.receipts");
  const verification = useTranslations("market.receipt");
  const format = useFormat();
  const longDate = useLongDate();
  const party = useParty();
  return (
    <ul className="flex flex-col gap-3 lg:hidden">
      {receipts.map((receipt) => (
        <li
          key={receipt.tradeId}
          className="relative flex flex-col gap-2 border-b border-border py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <InvoiceLink
              receipt={receipt}
              className="after:absolute after:inset-0 focus-visible:ring-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            />
            <p className="font-semibold tabular-nums">
              {format.money(receipt.totalPaise)}
            </p>
          </div>
          <p className="text-sm">{t("sideWith", party(receipt))}</p>
          <StatusPill tone="neutral">{verification("unverified")}</StatusPill>
          <p className="text-sm text-muted-foreground">
            {t("line", {
              material: format.material(
                receipt.material.names,
                receipt.material.code,
              ),
              weight: format.weight(receipt.grams),
              date: longDate(receipt.recordedAt),
            })}
          </p>
          <div>
            <EwayPill receipt={receipt} long />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Wider screens: the same invoices as a table. */
function ReceiptTable({ receipts }: { receipts: Receipt[] }) {
  const t = useTranslations("compliance.receipts");
  const verification = useTranslations("market.receipt");
  const format = useFormat();
  const longDate = useLongDate();
  const party = useParty();
  return (
    <div className="hidden border-y border-border lg:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("number")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("with")}</TableHead>
            <TableHead>{t("what")}</TableHead>
            <TableHead className="text-end">{t("amount")}</TableHead>
            <TableHead>{t("eway")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((receipt) => {
            const { side, name } = party(receipt);
            return (
              <TableRow key={receipt.tradeId}>
                <TableCell>
                  <InvoiceLink receipt={receipt} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {longDate(receipt.recordedAt)}
                </TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    <span>{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {side}
                    </span>
                    <StatusPill tone="neutral">
                      {verification("unverified")}
                    </StatusPill>
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    <span>
                      {format.material(
                        receipt.material.names,
                        receipt.material.code,
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format.weight(receipt.grams)}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-end font-medium tabular-nums">
                  {format.money(receipt.totalPaise)}
                </TableCell>
                <TableCell>
                  <EwayPill receipt={receipt} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** The business's tax invoices, each linking to the invoice itself. */
export function Receipts({ receipts }: { receipts: Receipt[] }) {
  const t = useTranslations("compliance.receipts");
  return (
    <Section title={t("title")}>
      {receipts.length === 0 ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={t("empty")}
          body={t("emptyBody")}
        />
      ) : (
        <>
          <p className="-mt-1 text-sm text-muted-foreground">{t("lead")}</p>
          <ReceiptCards receipts={receipts} />
          <ReceiptTable receipts={receipts} />
          <p className="text-xs text-muted-foreground">{t("ewayNote")}</p>
        </>
      )}
    </Section>
  );
}
