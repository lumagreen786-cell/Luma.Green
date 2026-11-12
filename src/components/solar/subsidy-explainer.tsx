import { ExternalLinkIcon, LandmarkIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { subsidyFor } from "./calc";

/** The scheme's own site: every subsidy figure on /solar cites it. */
export const PM_SURYA_GHAR_URL = "https://pmsuryaghar.gov.in";

/** PM Surya Ghar in short: who gets what, and where the rules live. */
export async function SubsidyExplainer() {
  const [t, format] = await Promise.all([
    getTranslations("solar.subsidy"),
    getFormatter(),
  ]);
  const money = (rupees: number) =>
    format.number(rupees, {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    });
  const slabs = [1, 2, 3].map((kw) => ({
    kw,
    label: t(kw === 3 ? "atLeast" : "kw", { kw: format.number(kw) }),
    amount: subsidyFor("home", kw),
  }));

  return (
    <section
      aria-labelledby="solar-subsidy"
      className="grid gap-8 border-y border-border py-8 lg:grid-cols-[3fr_2fr] lg:gap-12"
    >
      <div className="flex flex-col gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg border bg-card text-foreground">
          <LandmarkIcon aria-hidden className="size-5" />
        </span>
        <h2
          id="solar-subsidy"
          className="font-display text-2xl font-semibold tracking-tight"
        >
          {t("title")}
        </h2>
        <p>{t("body")}</p>
        <p className="text-muted-foreground">{t("business")}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
          {t("source")}
          <a
            href={PM_SURYA_GHAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("link")}
            <ExternalLinkIcon aria-hidden className="size-3.5" />
            <span className="sr-only">{t("newTab")}</span>
          </a>
        </p>
      </div>
      <div className="self-start overflow-hidden border-y border-border">
        <Table>
          <caption className="caption-bottom border-t px-4 py-2 text-start text-xs text-muted-foreground">
            {t("caption")}
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">{t("size")}</TableHead>
              <TableHead className="pe-4 text-end">{t("amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slabs.map((slab) => (
              <TableRow key={slab.kw}>
                <TableCell className="ps-4">{slab.label}</TableCell>
                <TableCell className="pe-4 text-end font-medium tabular-nums">
                  {money(slab.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
