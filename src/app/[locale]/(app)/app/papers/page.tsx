import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PaperPage } from "@/components/papers/paper-page";
import { localeFromParams } from "@/i18n/paths";
import { privateMetadata } from "@/lib/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "papers" });
  return privateMetadata(t("title"));
}
export default function Page() {
  return <PaperPage />;
}
