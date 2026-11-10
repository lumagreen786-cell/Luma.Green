import { ParticipantDirectory } from "@/components/join/participant-directory";
import { ParticipantPhoneGate } from "@/components/join/participant-phone-gate";
import { localeFromParams } from "@/i18n/paths";
import { requireSession } from "@/lib/require-session";

export default async function RolesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await localeFromParams(params);
  await requireSession(locale, "/join/roles");
  return (
    <ParticipantPhoneGate>
      <ParticipantDirectory />
    </ParticipantPhoneGate>
  );
}
