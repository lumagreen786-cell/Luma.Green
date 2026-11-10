import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ParticipantPhoneGate } from "@/components/join/participant-phone-gate";
import {
  ParticipantRequest,
  StakeholderRequest,
} from "@/components/join/stakeholder-request";
import { localeFromParams } from "@/i18n/paths";
import { requireSession } from "@/lib/require-session";
import { privateMetadata } from "@/lib/seo";

import { isParticipantType } from "../../../../../../convex/lib/participantTypes";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ participant?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "stakeholder" });
  return privateMetadata(t("title"));
}

export default async function StakeholderPage({ params, searchParams }: Props) {
  const locale = await localeFromParams(params);
  const { participant } = await searchParams;
  if (typeof participant === "string" && isParticipantType(participant)) {
    await requireSession(
      locale,
      `/join/stakeholder?participant=${participant}`,
    );
    return (
      <ParticipantPhoneGate>
        <ParticipantRequest participantType={participant} />
      </ParticipantPhoneGate>
    );
  }
  await requireSession(locale, "/join/stakeholder");
  return <StakeholderRequest />;
}
