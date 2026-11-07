import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TradesPage } from "@/components/market/trades-page";
import { localeFromParams } from "@/i18n/paths";
import { privateMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ procurement?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "app.nav" });
  return privateMetadata(t("trades"));
}

export default async function Page({ searchParams }: Props) {
  const { procurement } = await searchParams;
  return <TradesPage isRecycledPet={procurement === "pet"} />;
}
