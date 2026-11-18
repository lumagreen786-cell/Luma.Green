import { getTranslations } from "next-intl/server";

import { AfterlifeBusiness } from "@/components/site/afterlife/business";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "afterlife" });
  return pageMetadata({
    locale,
    path: "/business/collectors",
    title: t("collectors"),
    description: t("collectorMeta"),
  });
}
export default function CollectorsPage() {
  return <AfterlifeBusiness collectors />;
}
