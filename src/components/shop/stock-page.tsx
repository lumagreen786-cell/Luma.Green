"use client";

import { useQuery } from "convex/react";
import {
  IndianRupeeIcon,
  PackageIcon,
  PackageOpenIcon,
  ShoppingCartIcon,
  TagIcon,
  WeightIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import {
  AppPageHeader,
  DemoNote,
  EmptyState,
  ListSkeleton,
  Section,
  StatCard,
} from "@/components/app/page-parts";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { Button } from "@/components/ui/button";
import { useCanOperate } from "@/components/workspace/permissions";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { NotForYou, QueryBoundary } from "./guards";
import { MaterialIcon } from "./material-icon";
import { StockIntake } from "./stock-intake";
import type { Stock, StockRow } from "./types";
import { useBusiness } from "./use-shop";

/**
 * `/app/stock`, for every kind of business: what's on hand per material and
 * what it's worth today, with a way to sell it to the next step up the chain.
 */
export function StockPage() {
  const t = useTranslations("shop");
  const business = useBusiness();
  if (business === null) {
    return (
      <NotForYou
        title={t("stock.title")}
        icon={PackageIcon}
        heading={t("stock.notBusinessTitle")}
        body={t("stock.notBusinessBody")}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <AppPageHeader title={t("stock.title")} lead={t("stock.lead")} />
      {business ? (
        <QueryBoundary key={business.id}>
          <StockBody />
        </QueryBoundary>
      ) : (
        <ListSkeleton />
      )}
      <DemoNote>{t("sampleNote")}</DemoNote>
    </div>
  );
}

function StockBody() {
  const t = useTranslations("shop.stock");
  const market = useTranslations("market.home");
  const intake = useTranslations("stockIntake");
  const canOperate = useCanOperate();
  const format = useFormat();
  const stock = useQuery(api.stock.mine);
  if (stock === undefined) return <ListSkeleton rows={4} />;
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label={t("totalWeight")}
          value={format.weight(stock.totalGrams)}
          icon={WeightIcon}
        />
        <StatCard
          label={t("worth")}
          value={
            stock.totalValuePaise === null
              ? "—"
              : format.money(stock.totalValuePaise)
          }
          hint={t(stock.totalValuePaise === null ? "noPrice" : "worthHint")}
          icon={IndianRupeeIcon}
          tone="good"
        />
      </div>
      {canOperate ? (
        <Button asChild size="lg" className="h-12 text-base sm:w-fit sm:px-6">
          <Link href="/app/sell">
            <TagIcon aria-hidden className="size-5" />
            {stock.buyerKind ? t(`sellTo.${stock.buyerKind}`) : market("sell")}
          </Link>
        </Button>
      ) : null}
      {stock.kind === "manufacturer" ? (
        <WorkflowTabs
          items={[
            {
              value: "stock",
              label: t("title"),
              content: <StockList stock={stock} />,
            },
            {
              value: "intake",
              label: intake("title"),
              content: <StockIntake />,
            },
          ]}
        />
      ) : (
        <StockList stock={stock} />
      )}
    </>
  );
}

function StockList({ stock }: { stock: Stock }) {
  const t = useTranslations("shop.stock");
  if (stock.rows.length === 0) {
    const isShop = stock.kind === "kabadiwala";
    return (
      <EmptyState
        icon={PackageOpenIcon}
        title={t("emptyTitle")}
        body={t(isShop ? "emptyShop" : "emptyBusiness")}
        action={
          isShop ? null : (
            <Button asChild variant="outline" size="lg" className="mt-2 h-11">
              <Link href="/app/market">
                <ShoppingCartIcon aria-hidden />
                {t("buy")}
              </Link>
            </Button>
          )
        }
      />
    );
  }
  const groups = (["scrap", "recycled"] as const)
    .map((stage) => ({
      stage,
      rows: stock.rows.filter((row) => row.stage === stage),
    }))
    .filter((group) => group.rows.length > 0);
  const list = (rows: StockRow[]) => (
    <ul className="flex flex-col border-y border-border">
      {rows.map((row) => (
        <StockItem
          key={row.material.code}
          row={row}
          totalGrams={stock.totalGrams}
        />
      ))}
    </ul>
  );
  if (groups.length === 1) {
    return (
      <section aria-labelledby="stock-list" className="flex flex-col gap-3">
        <h2 id="stock-list" className="sr-only">
          {t(groups[0]?.stage ?? "scrap")}
        </h2>
        {list(stock.rows)}
      </section>
    );
  }
  return (
    <>
      {groups.map((group) => (
        <Section key={group.stage} title={t(group.stage)}>
          {list(group.rows)}
        </Section>
      ))}
    </>
  );
}

function StockItem({ row, totalGrams }: { row: StockRow; totalGrams: number }) {
  const t = useTranslations("shop.stock");
  const format = useFormat();
  const share = totalGrams > 0 ? Math.round((row.grams / totalGrams) * 100) : 0;
  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <MaterialIcon family={row.material.family} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">
            {format.material(row.material.names, row.material.code)}
          </span>
          <span className="text-sm text-muted-foreground">
            {row.marketPaise === null
              ? t("noPrice")
              : t("atPrice", { price: format.perKg(row.marketPaise) })}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-xl font-semibold tabular-nums">
            {format.weight(row.grams)}
          </span>
          {row.valuePaise === null ? null : (
            <span className="text-sm text-muted-foreground tabular-nums">
              {format.money(row.valuePaise)}
            </span>
          )}
        </div>
      </div>
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${String(Math.max(share, 2))}%` }}
        />
      </div>
    </li>
  );
}
