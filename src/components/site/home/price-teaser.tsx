"use client";

import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/** Keep home idle for safe native restart; locality entry belongs on /prices. */
export function PriceTeaser() {
  const t = useTranslations("home.teaser");
  const prices = useTranslations("prices");
  return (
    <div className="grid gap-4 py-1 lg:grid-cols-[1fr_2fr] lg:gap-x-12">
      <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
      <div className="flex min-w-0 flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">{prices("lead")}</p>
        <Link
          href="/prices"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("seeAll")}
          <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
