import { ArrowRightIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { MATERIAL_FAMILY_ICONS } from "@/components/app/material-family";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import {
  CATALOGUE,
  type Family,
  materialName,
} from "../../../../convex/lib/catalogue";
import { Container } from "../container";
import { SectionHeading } from "../section-heading";

const families = [
  "paper",
  "plastic",
  "metal",
  "glass",
  "ewaste",
  "other",
] as const satisfies readonly Family[];

/** Examples come from the product catalogue, never from an invented price list. */
export async function MaterialDirectory() {
  const [home, prices, locale] = await Promise.all([
    getTranslations("home"),
    getTranslations("prices.families"),
    getLocale(),
  ]);

  return (
    <section
      aria-labelledby="materials-heading"
      className="border-b py-6 sm:py-8"
    >
      <Container className="space-y-5">
        <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="materials-heading"
            title={home("expansion.materialsTitle")}
          />
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-11 max-w-full min-w-0 self-start py-3 text-start whitespace-nowrap lg:shrink-0"
          >
            <Link href="/sell">
              {home("hero.sell")}
              <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <ul className="grid border-t md:grid-cols-2 md:gap-x-12">
          {families.map((family) => {
            const Icon = MATERIAL_FAMILY_ICONS[family];
            const examples = CATALOGUE.filter(
              (item) => item.stage === "scrap" && item.family === family,
            ).slice(0, 3);
            return (
              <li key={family} data-reveal className="min-w-0 border-b">
                <Link
                  href="/sell"
                  className="group grid min-h-28 grid-cols-[2rem_minmax(0,1fr)_1.25rem] items-center gap-4 py-5 transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 sm:py-6"
                >
                  <Icon aria-hidden className="size-6 text-primary" />
                  <div className="min-w-0 space-y-2">
                    <h3 className="font-display text-xl font-semibold tracking-tight">
                      {prices(family)}
                    </h3>
                    <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm leading-relaxed text-muted-foreground">
                      {examples.map((item) => (
                        <li
                          key={item.code}
                          className="flex items-baseline gap-2"
                        >
                          {materialName(item.names, locale, item.code)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ArrowRightIcon
                    aria-hidden
                    className="size-4 text-muted-foreground rtl:rotate-180"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
