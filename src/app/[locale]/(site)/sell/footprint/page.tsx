import { getTranslations } from "next-intl/server";

import { ElectricityFootprint } from "@/components/sell/electricity-footprint";
import { Container } from "@/components/site/container";
import { privateMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("householdTools");
  return privateMetadata(t("footprint"));
}

export default async function FootprintPage() {
  const t = await getTranslations("householdTools");
  return (
    <Container className="flex max-w-xl flex-col gap-6 py-8">
      <h1 className="font-display text-2xl font-semibold">
        {t("electricityTitle")}
      </h1>
      <ElectricityFootprint />
    </Container>
  );
}
