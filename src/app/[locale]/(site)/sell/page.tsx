import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MyBookings } from "@/components/sell/my-bookings";
import { SellFlow } from "@/components/sell/sell-flow";
import { SellHero } from "@/components/sell/sell-hero";
import { Container } from "@/components/site/container";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "sell" });
  return pageMetadata({
    locale,
    path: "/sell",
    title: t("simple.title"),
    description: t("metaDescription"),
  });
}

/**
 * `/sell`: a household sells scrap without an account — docs/product/household.md.
 * Public and indexed; the booking itself needs only an SMS code.
 */
export default function SellPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <Container className="flex max-w-6xl flex-col gap-5 pt-6 pb-12 sm:pt-8">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0 space-y-4 lg:sticky lg:top-6">
            <SellHero />
            <MyBookings />
          </div>
          <div className="min-w-0 rounded-2xl bg-card p-5 sm:p-6">
            <SellFlow />
          </div>
        </div>
      </Container>
    </div>
  );
}
