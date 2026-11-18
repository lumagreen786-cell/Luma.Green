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
    path: "/business",
    title: t("businessMeta"),
    description: t("businessLead"),
  });
}
export default function BusinessPage() {
  return <AfterlifeBusiness />;
}
