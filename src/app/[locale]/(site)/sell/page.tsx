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
    title: t("metaTitle"),
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
      <Container className="grid max-w-6xl items-start gap-8 pt-6 pb-10 sm:pt-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-16 lg:py-12">
        <SellHero />
        <div className="flex min-w-0 flex-col gap-6">
          <MyBookings />
          <SellFlow />
        </div>
      </Container>
    </div>
  );
}
