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
    <Container className="flex max-w-7xl flex-col gap-8 py-10">
      <h1 className="border-b border-border pb-6 font-display text-4xl font-normal tracking-tight sm:text-5xl">
        {t("settings")}
      </h1>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <HouseholdFamily />
        <div className="space-y-4">
          <DailyReminder />
          <Link
            href="/account/security"
            className="flex min-h-14 items-center rounded-2xl border border-border bg-card p-5 font-medium text-card-foreground text-foreground hover:underline"
          >
            {account("title")}
          </Link>
        </div>
      </div>
    </Container>
  );
}
