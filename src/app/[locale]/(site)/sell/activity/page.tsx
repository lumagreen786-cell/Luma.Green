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
    <Container className="max-w-6xl space-y-5 py-8">
      <h1 className="font-display text-2xl font-semibold">{t("activity")}</h1>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <MyBookings showEmpty />
        <SharedFamilyCollections />
      </div>
    </Container>
  );
}
