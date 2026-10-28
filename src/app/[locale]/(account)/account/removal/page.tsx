import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountRemoval } from "@/components/account/account-removal";
import { localeFromParams } from "@/i18n/paths";
import { requireSession } from "@/lib/require-session";
import { privateMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "accountRemoval" });
  return { ...privateMetadata(t("title")), referrer: "no-referrer" };
}

export default async function AccountRemovalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await localeFromParams(params);
  await requireSession(locale, "/account/removal");
  return <AccountRemoval />;
}
