import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ServicesPage } from "@/components/services/services-page";
import { localeFromParams } from "@/i18n/paths";
import { requireSession } from "@/lib/require-session";
import { privateMetadata } from "@/lib/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "serviceRecords" });
  return privateMetadata(t("title"));
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await localeFromParams(params);
  await requireSession(locale, "/account/services");
  return <ServicesPage />;
}
