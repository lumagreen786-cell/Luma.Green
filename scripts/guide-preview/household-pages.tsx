import { useTranslations } from "next-intl";

import { SharedFamilyCollections } from "@/components/sell/household-family";
import { MyBookings } from "@/components/sell/my-bookings";
import { Container } from "@/components/site/container";

/** Exact activity composition, with the server session boundary replaced only in this isolated harness. */
export function HouseholdActivityFixture() {
  const t = useTranslations("householdTools");
  return (
    <Container className="max-w-2xl py-8">
      <h1 className="font-display text-2xl font-semibold">{t("activity")}</h1>
      <MyBookings showEmpty />
      <SharedFamilyCollections />
    </Container>
  );
}
