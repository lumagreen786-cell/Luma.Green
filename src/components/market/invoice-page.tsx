"use client";

import { useQuery } from "convex/react";
import {
  ArrowLeftIcon,
  FileTextIcon,
  InfoIcon,
  PrinterIcon,
  ReceiptTextIcon,
  SearchXIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import {
  AppPageHeader,
  EmptyState,
  StatusPill,
} from "@/components/app/page-parts";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { TradeReceipt } from "./types";
import { useOrg } from "./use-org";

/**
 * Printing shows the receipt alone: everything else on the page (the app's
 * sidebar, top bar and tabs) is hidden, and the receipt starts at the top.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  body * { visibility: hidden !important; }
  #trade-receipt, #trade-receipt * { visibility: visible !important; }
  #trade-receipt { position: absolute; top: 0; inset-inline: 0; }
}
`;

/**
 * `/app/trades/[id]/invoice`: the trade receipt, for either side of the
 * trade, ready to print. Legacy receipts are unverified prototype records,
 * not evidence of provider payment or a GST tax invoice.
 */
export function InvoicePage({ id }: { id: string }) {
  const t = useTranslations("market");
  const org = useOrg();
  if (!org) {
    return (
      <>
        <AppPageHeader title={t("receipt.title")} />
        <EmptyState
          icon={ReceiptTextIcon}
          title={t("forBusinessesTitle")}
          body={t("forBusinessesBody")}
        />
      </>
    );
  }
  return <Receipt id={id} />;
}

function Receipt({ id }: { id: string }) {
  const t = useTranslations("market.receipt");
  const trades = useTranslations("market.trades");
  const receipt = useQuery(api.market.receipt, { tradeId: id });

  if (receipt === undefined) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (receipt === null) {
    return (
      <>
        <AppPageHeader title={t("missingTitle")} />
        <EmptyState
          icon={SearchXIcon}
          title={t("missingTitle")}
          body={t("missingBody")}
          action={<BackToTrades />}
        />
      </>
    );
  }
  // Old LG numbers remain visible as history, never as a verified payment.
  const reference =
    receipt.directCashReceipt?.reference ?? receipt.legacyReceiptNo;
  const recordedAt =
    receipt.directCashReceipt?.recordedAt ?? receipt.legacyRecordedAt;
  if (reference === null || recordedAt === null) {
    return (
      <>
        <AppPageHeader title={t("title")} />
        <EmptyState
          icon={ReceiptTextIcon}
          title={t("pendingTitle")}
          body={
            receipt.status === "declined"
              ? t("declinedBody")
              : trades("gatewayPending")
          }
          action={<BackToTrades />}
        />
      </>
    );
  }
  return (
    <ReceiptDocument
      receipt={receipt}
      number={reference}
      recordedAt={recordedAt}
    />
  );
}

function BackToTrades() {
  const t = useTranslations("market.receipt");
  return (
    <Button asChild variant="outline" size="lg" className="mt-2 h-11">
      <Link href="/app/trades">
        <ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
        {t("back")}
      </Link>
    </Button>
  );
}

function ReceiptDocument({
  receipt,
  number,
  recordedAt,
}: {
  receipt: TradeReceipt;
  number: string;
  recordedAt: number;
}) {
  const t = useTranslations("market");
  const format = useFormat();
  const formatter = useFormatter();
  const payment = useTranslations("tradeLifecycle");
  // A receipt is kept, so its dates carry the year.
  const fullDate = (at: number) =>
    formatter.dateTime(new Date(at), { dateStyle: "medium" });
  const { line } = receipt;
  const weight = format.weight(line.grams);
  const rate = t("perKg", { price: format.perKg(line.paisePerKg) });

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="lg" className="h-11 px-2">
          <Link href="/app/trades">
            <ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
            {t("receipt.back")}
          </Link>
        </Button>
        <Button
          size="lg"
          className="h-11 px-4 text-base"
          onClick={() => {
            window.print();
          }}
        >
          <PrinterIcon aria-hidden />
          {t("receipt.print")}
        </Button>
      </div>

      <article
        id="trade-receipt"
        className="flex flex-col gap-6 rounded-xl border border-border/60 bg-card p-5 sm:p-6 print:border-0 print:p-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div className="flex flex-col gap-3">
            <Logo idPrefix="lg-receipt" />
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {t("receipt.title")}
            </h1>
          </div>
          <dl className="grid grid-cols-[auto_auto] items-center gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">
              {t("receipt.numberLabel")}
            </dt>
            <dd className="font-mono font-medium">{number}</dd>
            <dt className="text-muted-foreground">{t("receipt.dateLabel")}</dt>
            <dd>{fullDate(recordedAt)}</dd>
            <dt className="text-muted-foreground">
              {t("receipt.statusLabel")}
            </dt>
            <dd>
              <StatusPill tone="neutral">
                {receipt.directCashReceipt
                  ? payment("cashReported")
                  : t("receipt.unverified")}
              </StatusPill>
            </dd>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Party title={t("receipt.seller")} party={receipt.seller} />
          <Party title={t("receipt.buyer")} party={receipt.buyer} />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("receipt.material")}</TableHead>
              <TableHead className="hidden text-end sm:table-cell print:table-cell">
                {t("receipt.quantity")}
              </TableHead>
              <TableHead className="hidden text-end sm:table-cell print:table-cell">
                {t("receipt.rate")}
              </TableHead>
              <TableHead className="text-end">{t("receipt.amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="whitespace-normal">
                <span className="font-medium">
                  {format.material(line.material.names, line.material.code)}
                </span>
                <span className="block text-muted-foreground tabular-nums sm:hidden print:hidden">
                  {t("receipt.lineSummary", { weight, rate })}
                </span>
              </TableCell>
              <TableCell className="hidden text-end tabular-nums sm:table-cell print:table-cell">
                {weight}
              </TableCell>
              <TableCell className="hidden text-end tabular-nums sm:table-cell print:table-cell">
                {rate}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {format.money(line.paise)}
              </TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="sm:hidden print:hidden">
                {t("receipt.total")}
              </TableCell>
              <TableCell
                colSpan={3}
                className="hidden text-end sm:table-cell print:table-cell"
              >
                {t("receipt.total")}
              </TableCell>
              <TableCell className="text-end text-base font-semibold tabular-nums">
                {format.money(receipt.totalPaise)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex gap-2">
            <InfoIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="flex flex-col gap-0.5">
              <p>
                {receipt.directCashReceipt
                  ? payment("cashNote")
                  : t("trades.legacyUnverified")}
              </p>
            </div>
          </div>
          {receipt.needsEwayBill ? (
            <p className="flex gap-2">
              <FileTextIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
              {t("receipt.ewayBill")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground">
          <p>{t("receipt.notTaxInvoice")}</p>
        </div>
      </article>
    </>
  );
}

function Party({
  title,
  party,
}: {
  title: string;
  party: TradeReceipt["seller"];
}) {
  const t = useTranslations("market.receipt");
  const roles = useTranslations("app.roles");
  return (
    <section className="flex flex-col gap-1 border-s-2 border-border ps-4 print:border-0 print:p-0">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <p className="font-semibold">{party.name}</p>
      <p className="text-sm text-muted-foreground">{roles(party.kind)}</p>
      <p className="text-sm">{party.address}</p>
      <p className="text-sm">
        {party.gstin ? t("gstin", { gstin: party.gstin }) : t("noGstin")}
      </p>
    </section>
  );
}
