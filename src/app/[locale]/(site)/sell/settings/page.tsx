import { getTranslations } from "next-intl/server";

import { DailyReminder } from "@/components/sell/daily-reminder";
import { HouseholdFamily } from "@/components/sell/household-family";
import { Container } from "@/components/site/container";
import { Link } from "@/i18n/navigation";
import { privateMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("householdTools");
  return privateMetadata(t("settings"));
}

export default async function SettingsPage() {
  const [t, account] = await Promise.all([
    getTranslations("householdTools"),
    getTranslations("accountSecurity"),
  ]);
  return (
    <Container className="flex max-w-xl flex-col gap-6 py-8">
      <h1 className="font-display text-2xl font-semibold">{t("settings")}</h1>
      <HouseholdFamily />
      <DailyReminder />
      <Link
        href="/account/security"
        className="inline-flex min-h-11 items-center self-start font-medium text-primary hover:underline"
      >
        {account("title")}
      </Link>
    </Container>
  );
}
