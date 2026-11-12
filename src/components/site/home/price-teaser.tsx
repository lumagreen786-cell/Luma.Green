"use client";

import { ArrowRightIcon, ChartNoAxesCombinedIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/** Keep home idle for safe native restart; locality entry belongs on /prices. */
export function PriceTeaser() {
  const t = useTranslations("home.teaser");
  const prices = useTranslations("prices");
  return (
    <div className="grid items-center gap-4 rounded-panel border border-border/60 bg-card px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)]">
      <ChartNoAxesCombinedIcon
        aria-hidden
        className="size-10 rounded-lg bg-secondary/35 p-2 text-foreground"
      />
      <h2 className="text-base font-normal tracking-tight">{t("title")}</h2>
      <div className="flex min-w-0 flex-col items-start gap-2 sm:col-span-2 lg:col-span-1">
        <p className="text-sm text-muted-foreground">{prices("lead")}</p>
        <Link
          href="/prices"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("seeAll")}
          <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
