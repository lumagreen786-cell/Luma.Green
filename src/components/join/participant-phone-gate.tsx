"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

import { verifiedIndianMobile } from "../../../convex/lib/phone";
import { FormSkeleton } from "./join-gate";

export function ParticipantPhoneGate({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const t = useTranslations("accountPhone");
  if (session.isPending) return <FormSkeleton />;
  const user = session.data?.user;
  if (verifiedIndianMobile(user?.phoneNumber, user?.phoneNumberVerified))
    return <>{children}</>;

  return (
    <section className="flex flex-col items-start gap-4 border-t border-border py-6">
      <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
      <Link
        href="/account/security"
        className="inline-flex min-h-11 items-center font-medium text-primary underline"
      >
        {t("title")}
      </Link>
    </section>
  );
}
