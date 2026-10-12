"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InfoIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-next";

import { formatIndianMobile } from "../../../convex/lib/phone";
import { AuthProgress } from "./auth-progress";
import { LoginSkeleton } from "./login-flow";
import { readPhone, useStoredValue } from "./storage";

/** A disconnected UI preview. It deliberately has no auth or Convex client. */
export function VerifyPreview() {
  const t = useTranslations("auth");
  const phone = useStoredValue(readPhone);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/app");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (phone === null) {
      router.replace({ pathname: "/login", query: { next } });
    }
  }, [phone, next, router]);

  if (!phone) return <LoginSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <AuthProgress step="code" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
          {t("previewTitle")}
        </h1>
        <p className="text-muted-foreground">
          {t("previewNumber", {
            phone: `\u{2066}${formatIndianMobile(phone)}\u{2069}`,
          })}
        </p>
        <Link
          href={{ pathname: "/login", query: { next } }}
          className="inline-flex min-h-11 max-w-full items-center self-start py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("changeNumber")}
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        <Label htmlFor="preview-code" className="text-sm">
          {t("codeLabel")}
        </Label>
        <div dir="ltr" className="flex justify-center">
          <InputOTP
            id="preview-code"
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={setCode}
            aria-describedby="preview-notice"
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-12 w-10 text-lg sm:w-12"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <div
          id="preview-notice"
          role="status"
          className="flex gap-3 border-s-2 border-primary ps-4 text-sm leading-relaxed text-muted-foreground"
        >
          <InfoIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          <p>{t("previewBody")}</p>
        </div>
        <Button
          size="lg"
          className="w-full"
          disabled
          aria-describedby="preview-notice"
        >
          {t("verify")}
        </Button>
        <Button
          variant="ghost"
          className="min-h-11"
          disabled
          aria-describedby="preview-notice"
        >
          {t("resend")}
        </Button>
      </div>
    </div>
  );
}
