import { getTranslations } from "next-intl/server";

import { SharedFamilyCollections } from "@/components/sell/household-family";
import { MyBookings } from "@/components/sell/my-bookings";
import { Container } from "@/components/site/container";
import { localeFromParams } from "@/i18n/paths";
import { requireSession } from "@/lib/require-session";
import { privateMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("householdTools");
  return privateMetadata(t("activity"));
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await localeFromParams(params);
  await requireSession(locale, "/sell/activity");
  const t = await getTranslations("householdTools");
  return (
    <Container className="max-w-2xl py-8">
      <h1 className="font-display text-2xl font-semibold">{t("activity")}</h1>
      <MyBookings showEmpty />
      <SharedFamilyCollections />
    </Container>
  );
}
