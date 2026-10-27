"use client";

import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { navigateToAdmin } from "@/lib/admin-navigation";
import { safeNextPath } from "@/lib/safe-next";

import { api } from "../../../convex/_generated/api";
import { clearPhoneChallenge } from "./storage";

/** Mounted only after Better Auth and Convex both confirm the existing session. */
export function ResumeSession() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/app");
  const ensureProfile = useMutation(api.identity.ensureProfile);
  const person = useQuery(api.identity.me);
  const pending = useRef(false);
  const isMounted = useRef(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (person === undefined || failed || pending.current) return;
    pending.current = true;
    void ensureProfile({ locale })
      .then(() => {
        if (!isMounted.current) return;
        clearPhoneChallenge();
        if (person?.kind === "admin") navigateToAdmin(person.twoFactorEnabled);
        else router.replace(next);
      })
      .catch(() => {
        if (!isMounted.current) return;
        pending.current = false;
        setFailed(true);
      });
  }, [attempt, ensureProfile, failed, locale, next, person, router]);
  return (
    <div className="flex flex-col gap-4">
      <p role={failed ? "alert" : "status"}>
        {t(failed ? "error" : "loading")}
      </p>
      {failed ? (
        <Button
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}
