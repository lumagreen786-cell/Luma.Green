import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PrivacyContent } from "@/components/site/privacy-content";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "privacy" });
  return pageMetadata({
    locale,
    path: "/privacy",
    title: t("title"),
    description: t("lead"),
  });
}

export default function PrivacyPage() {
  return <PrivacyContent />;
}
