"use client";

import { useMutation, useQuery } from "convex/react";
import { CalendarIcon, TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import {
  EmptyState,
  ListSkeleton,
  Section,
  StatusPill,
} from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { useCanOperate } from "@/components/workspace/permissions";

import { api } from "../../../convex/_generated/api";
import { marketErrorKey } from "./errors";
import { ListingCard } from "./listing-card";
import { MaterialIcon } from "./material-icon";
import type { ListingView } from "./types";

/** My lots: what's on sale now (each can be withdrawn), then earlier ones. */
export function MyListings() {
  const t = useTranslations("market.sell.mine");
  const listings = useQuery(api.market.myListings);

  if (listings === undefined) return <ListSkeleton rows={2} />;
  const open = listings.filter((listing) => listing.status === "open");
  const past = listings.filter((listing) => listing.status !== "open");

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
      <Section title={t("title")}>
        {open.length === 0 ? (
          <EmptyState
            icon={TagIcon}
            title={t("emptyTitle")}
            body={t("emptyBody")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((listing) => (
              <li key={listing.id}>
                <OpenListing listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      {past.length > 0 ? (
        <Section title={t("past")}>
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4 sm:px-5">
            {past.map((listing) => (
              <li key={listing.id}>
                <PastListing listing={listing} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function OpenListing({ listing }: { listing: ListingView }) {
  const t = useTranslations("market.sell.mine");
  const format = useFormat();
  return (
    <ListingCard
      listing={listing}
      badge={<StatusPill tone="good">{t("onSale")}</StatusPill>}
      meta={
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarIcon aria-hidden className="size-3.5 shrink-0" />
          {t("listedOn", { date: format.date(listing.createdAt) })}
        </p>
      }
      action={<WithdrawButton listing={listing} />}
    />
  );
}

function PastListing({ listing }: { listing: ListingView }) {
  const t = useTranslations("market");
  const format = useFormat();
  return (
    <div className="flex flex-wrap items-center gap-3 py-4">
      <MaterialIcon family={listing.material.family} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">
          {format.material(listing.material.names, listing.material.code)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t("sell.mine.pastLine", {
            date: format.date(listing.createdAt),
            price: format.perKg(listing.askPaisePerKg),
          })}
        </span>
      </div>
      <StatusPill tone={listing.status === "sold" ? "info" : "neutral"}>
        {t(
          listing.status === "sold" ? "sell.mine.sold" : "sell.mine.withdrawn",
        )}
      </StatusPill>
    </div>
  );
}

/** Takes a lot off the market — after asking, since it can't be undone. */
function WithdrawButton({ listing }: { listing: ListingView }) {
  const canOperate = useCanOperate();
  const t = useTranslations("market");
  const format = useFormat();
  const withdraw = useMutation(api.market.withdraw);
  const questionId = useId();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const material = format.material(
    listing.material.names,
    listing.material.code,
  );

  async function confirm() {
    setIsWorking(true);
    try {
      await withdraw({ listingId: listing.id });
      toast.success(t("sell.mine.withdrawnToast", { material }));
    } catch (error) {
      toast.error(t(`errors.${marketErrorKey(error)}`));
    } finally {
      setIsWorking(false);
      setIsConfirming(false);
    }
  }

  if (!isConfirming) {
    if (!canOperate) return null;
    return (
      <Button
        variant="outline"
        size="lg"
        className="h-11"
        aria-label={t("sell.mine.withdrawLabel", { material })}
        onClick={() => {
          setIsConfirming(true);
        }}
      >
        {t("sell.mine.withdraw")}
      </Button>
    );
  }
  return (
    <div
      role="alertdialog"
      aria-labelledby={questionId}
      className="flex flex-col gap-3 border-s-2 border-destructive ps-4"
    >
      <p id={questionId} className="text-sm">
        {t("sell.mine.withdrawConfirm")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          size="lg"
          className="h-11"
          disabled={isWorking}
          onClick={() => void confirm()}
        >
          {t("sell.mine.withdrawYes")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-11"
          disabled={isWorking}
          onClick={() => {
            setIsConfirming(false);
          }}
        >
          {t("sell.mine.withdrawNo")}
        </Button>
      </div>
    </div>
  );
}
