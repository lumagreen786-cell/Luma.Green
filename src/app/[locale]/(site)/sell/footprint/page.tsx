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
    <Container className="flex max-w-7xl flex-col gap-8 py-10">
      <h1 className="border-b border-border pb-6 font-display text-4xl font-normal tracking-tight sm:text-5xl">
        {t("electricityTitle")}
      </h1>
      <ElectricityFootprint />
    </Container>
  );
}
