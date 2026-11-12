import { useTranslations } from "next-intl";

import { SharedFamilyCollections } from "@/components/sell/household-family";
import { MyBookings } from "@/components/sell/my-bookings";
import { Container } from "@/components/site/container";

/** Exact activity composition, with the server session boundary replaced only in this isolated harness. */
export function HouseholdActivityFixture() {
  const t = useTranslations("householdTools");
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
