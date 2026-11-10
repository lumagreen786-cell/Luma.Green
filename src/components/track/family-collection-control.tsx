"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";

export function FamilyCollectionControl({
  token,
  shared,
}: {
  token: string;
  shared: boolean;
}) {
  const t = useTranslations("householdFamily");
  const common = useTranslations("common");
  const shareCollection = useMutation(api.householdFamily.shareCollection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"recent" | "verified" | "generic" | null>(
    null,
  );

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await shareCollection({ token, share: !shared });
    } catch (error_) {
      const code: unknown = error_ instanceof ConvexError ? error_.data : null;
      if (code === "RECENT_AUTH_REQUIRED") setError("recent");
      else if (code === "VERIFIED_PHONE_REQUIRED") setError("verified");
      else setError("generic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-3 rounded-xl bg-muted/40 p-4"
      aria-labelledby="family-collection-access"
    >
      <h2 id="family-collection-access" className="text-lg font-semibold">
        <Link href="/sell/settings" className="hover:underline">
          {t("title")}
        </Link>
      </h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <ActionButton
        label={t(shared ? "makePrivate" : "share")}
        isDisabled={busy}
        onClick={() => void toggle()}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error === "generic" ? common("error") : t(error)}
        </p>
      ) : null}
    </section>
  );
}
