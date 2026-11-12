"use client";

import {
  BatteryIcon,
  FileCheckIcon,
  InfoIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { EmptyState, Section } from "@/components/app/page-parts";

import { FAMILY_ICONS } from "./families";
import type { Epr } from "./types";

type Stream = Epr["rows"][number]["stream"];

const STREAM_ICONS: Record<Stream, LucideIcon> = {
  ...FAMILY_ICONS,
  battery: BatteryIcon,
};

/**
 * The financial year's Extended Producer Responsibility record for a
 * recycler (received and recycled) or a manufacturer (recycled content
 * bought), with the rules that cover each material.
 */
export function EprSummary({ epr }: { epr: Epr }) {
  const t = useTranslations("compliance.epr");
  const format = useFormat();
  const isRecycler = epr.role === "recycler";

  return (
    <Section
      title={t("title", { from: epr.from.slice(0, 4), to: epr.to.slice(2, 4) })}
    >
      <p className="-mt-1 text-sm text-muted-foreground">
        {t(isRecycler ? "lead" : "leadManufacturer")}
      </p>
      {epr.rows.length === 0 ? (
        <EmptyState
          icon={FileCheckIcon}
          title={t("empty")}
          body={t("emptyBody")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {epr.rows.map((row) => {
            const Icon = STREAM_ICONS[row.stream];
            return (
              <li
                key={row.stream}
                className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-foreground">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-medium">
                      {t(`streams.${row.stream}`)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(`regimes.${row.regime ?? "none"}`)}
                    </p>
                  </div>
                </div>
                <dl className="flex flex-wrap gap-x-6 gap-y-2 ps-13 sm:ps-0">
                  <div className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">
                      {t(isRecycler ? "received" : "bought")}
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {format.weight(row.receivedGrams)}
                    </dd>
                  </div>
                  {isRecycler ? (
                    <div className="flex flex-col">
                      <dt className="text-xs text-muted-foreground">
                        {t("recycled")}
                      </dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {format.weight(row.recycledGrams)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-start gap-2 border-s-2 border-border ps-3 text-sm">
        <InfoIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        {t("note")}
      </p>
    </Section>
  );
}
