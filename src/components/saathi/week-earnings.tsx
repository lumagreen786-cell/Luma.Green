"use client";

import { ChevronRightIcon, WalletIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { useFormat } from "@/components/app/format";
import { Link } from "@/i18n/navigation";

import type { Board } from "./job-meta";

/** The one number a Saathi opens the app for: what they earned this week. */
export function WeekEarnings({ earnings }: { earnings: Board["earnings"] }) {
  const t = useTranslations("saathi.week");
  const format = useFormat();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 rounded-2xl bg-card p-5 sm:p-6"
    >
      <div className="col-span-2 flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-medium">
          {t("label")}
        </h2>
        <WalletIcon aria-hidden className="size-5" />
      </div>
      <p className="font-display text-3xl font-semibold tracking-tight text-primary tabular-nums">
        {format.money(earnings.weekPaise)}
      </p>
      <p className="col-start-1 text-sm text-muted-foreground">
        {t("hint", { count: earnings.weekJobs })}
      </p>
      <Link
        href="/app/impact"
        className="col-start-2 row-span-2 row-start-2 inline-flex min-h-11 flex-wrap items-center justify-center gap-1 self-start rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("all")}
        <ChevronRightIcon aria-hidden className="size-4 rtl:rotate-180" />
      </Link>
    </section>
  );
}
