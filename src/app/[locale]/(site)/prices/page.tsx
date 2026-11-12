import { ArrowRightIcon, PackageOpenIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PriceBoard } from "@/components/prices/price-board";
import { PriceGuide } from "@/components/prices/price-guide";
import { Container } from "@/components/site/container";
import { PageHeader } from "@/components/site/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "prices" });

  return pageMetadata({
    locale,
    path: "/prices",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** The public price board for Bengaluru — docs/product/pricing.md. */
export default async function PricesPage() {
  const t = await getTranslations("prices");
  const help = await getTranslations("help");
  const sell = await getTranslations("sell");
  const nav = await getTranslations("nav");

  return (
    <>
      <PageHeader
        variant="task"
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        scene="fairWeighing"
      />

      <Container className="grid items-start gap-4 pb-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section
          aria-label={t("title")}
          className="min-w-0 rounded-panel bg-card p-5 shadow-panel sm:p-6"
        >
          <PriceBoard />
        </section>
        <div className="grid min-w-0 gap-4">
          <div className="space-y-3 rounded-xl bg-accent/40 p-5">
            <p className="text-sm text-muted-foreground">{t("floorHelp")}</p>
            <p className="text-sm text-muted-foreground">
              {sell("basket.weighNote")}
            </p>
          </div>
          <details className="rounded-panel bg-card p-5 shadow-panel">
            <summary className="cursor-pointer py-2 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              {help("guides.weighingAtDoor.title")}
            </summary>
            <PriceGuide />
          </details>

          <aside className="flex flex-col gap-4 rounded-panel bg-card p-5 shadow-panel">
            <div className="flex items-start gap-3">
              <PackageOpenIcon
                aria-hidden
                className="mt-0.5 size-6 shrink-0 text-foreground"
              />
              <div>
                <p className="text-lg font-semibold">{t("sellCta.title")}</p>
                <p className="text-muted-foreground">{t("sellCta.body")}</p>
              </div>
            </div>
            <Button asChild size="lg" className="h-12 px-5 text-base">
              <Link href="/sell">
                {nav("sellScrap")}
                <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
              </Link>
            </Button>
          </aside>
        </div>
      </Container>
    </>
  );
}
