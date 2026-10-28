"use client";

import { CircleXIcon, FileTextIcon, ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { StatusPill } from "@/components/app/page-parts";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { FinancialLifecycle } from "./financial-lifecycle";
import { isAvailableTradeAction, isOpenTrade, reachedAt } from "./logic";
import { MaterialIcon } from "./material-icon";
import { OfferComparison } from "./offer-comparison";
import { OfferSpecification } from "./offer-specification";
import { TradeActions } from "./trade-actions";
import { TradeSteps } from "./trade-steps";
import type { TradeSide, TradeView } from "./types";

/**
 * One trade: what and with whom, where it stands, what happens next, and —
 * when it's my turn — the button for it. `compact` (the home screen) leaves
 * out the steps and the footer.
 */
export function TradeCard({
  trade,
  side,
  compact = false,
  showSide = false,
}: {
  trade: TradeView;
  side: TradeSide;
  compact?: boolean;
  /** Label the card Buying or Selling, where both sides are mixed. */
  showSide?: boolean;
}) {
  const t = useTranslations("market.trades");
  const counterparty = {
    name: trade.counterparty.name,
    area: trade.counterparty.area,
  };
  const isHistorical = ["paid_to_escrow", "dispatched", "completed"].includes(
    trade.status,
  );
  const hasFinancialView = [
    "accepted",
    "dispatched",
    "completed",
    "declined",
  ].includes(trade.status);
  let hint: string;
  if (isHistorical) {
    hint = t("legacyUnverified");
  } else if (trade.status === "accepted") {
    hint = t("gatewayPending");
  } else {
    hint = t(`hint.${trade.status}.${side}`, counterparty);
  }
  const legacyContent = (
    <>
      <DeclinedNote trade={trade} />
      <p
        className={cn(
          "text-sm",
          trade.actions.some((action) => isAvailableTradeAction(action))
            ? "font-medium"
            : "text-muted-foreground",
        )}
      >
        {hint}
      </p>
    </>
  );
  return (
    <article className="flex h-full flex-col gap-3 border-b border-border py-4">
      <TradeHeading trade={trade} side={side} showSide={showSide} />
      {compact ? null : <OfferSpecification value={trade.specification} />}
      {compact ? null : (
        <OfferComparison
          listing={{
            askPaisePerKg: trade.paisePerKg,
            freightPaisePerKg: trade.freightPaisePerKg,
            deliveryAvailableAt: trade.deliveryAvailableAt,
          }}
        />
      )}
      {compact || isHistorical || trade.status === "declined" ? null : (
        <TradeSteps status={trade.status} />
      )}
      {hasFinancialView ? (
        <FinancialLifecycle
          key={trade.id}
          tradeId={trade.id}
          compact={compact}
          legacyContent={legacyContent}
        />
      ) : (
        legacyContent
      )}
      <TradeNotes trade={trade} />
      <TradeActions trade={trade} />
      {compact ? null : <TradeFooter trade={trade} />}
    </article>
  );
}

function TradeHeading({
  trade,
  side,
  showSide,
}: {
  trade: TradeView;
  side: TradeSide;
  showSide: boolean;
}) {
  const t = useTranslations("market.trades.card");
  const format = useFormat();
  const material = format.material(trade.material.names, trade.material.code);
  return (
    <div className="flex flex-wrap items-start gap-3">
      <MaterialIcon family={trade.material.family} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">
            {t("title", { material, weight: format.weight(trade.grams) })}
          </h3>
          {showSide ? (
            <StatusPill tone="neutral">
              {t(side === "buyer" ? "buying" : "selling")}
            </StatusPill>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {t(side === "buyer" ? "from" : "to", {
            name: trade.counterparty.name,
            area: trade.counterparty.area,
          })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-end">
        <p className="font-semibold whitespace-nowrap tabular-nums">
          {format.money(trade.totalPaise)}
        </p>
        <p className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {t("rate", { price: format.perKg(trade.paisePerKg) })}
        </p>
      </div>
    </div>
  );
}

function DeclinedNote({ trade }: { trade: TradeView }) {
  const t = useTranslations("market.trades");
  const format = useFormat();
  const declinedAt = reachedAt(trade, "declined");
  if (declinedAt === null) return null;
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-destructive">
      <CircleXIcon aria-hidden className="size-4 shrink-0" />
      {t("declined", { date: format.date(declinedAt) })}
    </p>
  );
}

/** A transport-document reminder; old payment flags are not provider proof. */
function TradeNotes({ trade }: { trade: TradeView }) {
  const t = useTranslations("market.trades.card");
  if (!trade.needsEwayBill || !isOpenTrade(trade.status)) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex gap-2 border-s-2 border-primary ps-3 text-sm text-muted-foreground">
        <FileTextIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t("ewayBill")}
      </p>
    </div>
  );
}

function TradeFooter({ trade }: { trade: TradeView }) {
  const t = useTranslations("market.trades.card");
  const format = useFormat();
  const lastStep = trade.timeline.at(-1)?.at ?? trade.createdAt;
  const legacyReceiptNo = trade.legacyReceiptNo;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
      <span>{t("updated", { when: format.dateTime(lastStep) })}</span>
      {legacyReceiptNo ? (
        <Link
          href={`/app/trades/${trade.id}/invoice`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ReceiptTextIcon aria-hidden className="size-4" />
          {t("receipt", { number: legacyReceiptNo })}
        </Link>
      ) : null}
    </div>
  );
}
