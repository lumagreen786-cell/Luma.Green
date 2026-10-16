"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Link, useRouter } from "@/i18n/navigation";
import {
  requestPhoneCode,
  type SendCodeErrorKey,
  verifyPhoneCode,
} from "@/lib/phone-auth";
import { safeNextPath } from "@/lib/safe-next";

import { api } from "../../../convex/_generated/api";
import { formatIndianMobile } from "../../../convex/lib/phone";
import { AuthProgress } from "./auth-progress";
import type { CodeErrorKey } from "./errors";
import { FactorChallenge } from "./factor-challenge";
import { LoginSkeleton } from "./login-flow";
import { PhoneForm } from "./phone-form";
import {
  readPhone,
  readPhoneSentAt,
  rememberPhone,
  useStoredValue,
} from "./storage";

/**
 * Keeps a number reading left to right inside Urdu and Arabic sentences
 * (Unicode directional isolates, U+2066 … U+2069).
 */
function ltr(text: string): string {
  return `\u{2066}${text}\u{2069}`;
}

const RESEND_AFTER_SECONDS = 300;
const CODE_LENGTH = 6;
const SESSION_WAIT_MS = 20_000;
/**
 * Where a sign-in lands when no `?next=` was given: the app, which sends
 * anyone without an approved business on to their application.
 */
const AFTER_SIGN_IN = "/app";

/** `/login/verify`: the 6-digit code, then into the app. */
export function VerifyFlow() {
  return isConvexConfigured ? <VerifyForm /> : <PhoneForm canSend={false} />;
}

function VerifyForm() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), AFTER_SIGN_IN);
  const { isAuthenticated } = useConvexAuth();
  const ensureProfile = useMutation(api.identity.ensureProfile);

  // The number lives in this tab's session storage, never in the URL.
  const phone = useStoredValue(readPhone);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    | "idle"
    | "checking"
    | "second-factor"
    | "verified"
    | "session-timeout"
    | "profile-error"
  >("idle");
  const [error, setError] = useState<CodeErrorKey | SendCodeErrorKey | null>(
    null,
  );
  const [resendAt, setResendAt] = useState(
    () => (readPhoneSentAt() ?? Date.now()) + RESEND_AFTER_SECONDS * 1000,
  );
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)),
  );
  const isFinishing = useRef(false);
  const requestPending = useRef(false);
  const [isResending, setResending] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  // After a wrong code the boxes are cleared; put the cursor back in them.
  useEffect(() => {
    if (error && status === "idle") codeInput.current?.focus();
  }, [error, status]);

  // No number means no code was sent from this tab: start again.
  useEffect(() => {
    if (phone === null && status === "idle") router.replace("/login");
  }, [phone, status, router]);

  useEffect(() => {
    const update = () => {
      const remainingSeconds = Math.ceil((resendAt - Date.now()) / 1000);
      setSecondsLeft(Math.max(0, remainingSeconds));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [resendAt]);

  // An accepted code must never be submitted again. If the session takes too
  // long, offer another bounded wait and still accept a late session.
  useEffect(() => {
    if (status !== "verified" || isAuthenticated) return;
    const timer = setTimeout(() => {
      setStatus("session-timeout");
      setError("errorGeneric");
    }, SESSION_WAIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [status, isAuthenticated]);

  // Convex picks up the new session a moment after the code is accepted; wait
  // for it before creating the profile.
  useEffect(() => {
    if (
      !isAuthenticated ||
      isFinishing.current ||
      (status !== "verified" && status !== "session-timeout")
    ) {
      return;
    }
    isFinishing.current = true;
    setStatus("verified");
    setError(null);
    void (async () => {
      try {
        await ensureProfile({ locale });
        router.replace(next);
      } catch {
        isFinishing.current = false;
        setStatus("profile-error");
        setError("errorGeneric");
      }
    })();
  }, [status, isAuthenticated, ensureProfile, locale, next, router]);

  async function verify(value: string) {
    if (
      !phone ||
      status !== "idle" ||
      requestPending.current ||
      value.length !== CODE_LENGTH
    )
      return;
    requestPending.current = true;
    setStatus("checking");
    setError(null);
    const result = await verifyPhoneCode(phone, value);
    requestPending.current = false;
    if (result.kind === "error") {
      setStatus("idle");
      setCode("");
      setError(result.error);
      return;
    }
    setStatus(result.kind === "second-factor" ? "second-factor" : "verified");
  }

  async function resend() {
    if (
      !phone ||
      status !== "idle" ||
      requestPending.current ||
      Date.now() < resendAt
    )
      return;
    requestPending.current = true;
    setResending(true);
    setError(null);
    const sendError = await requestPhoneCode(phone);
    requestPending.current = false;
    setResending(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    rememberPhone(phone);
    setResendAt(Date.now() + RESEND_AFTER_SECONDS * 1000);
    setSecondsLeft(RESEND_AFTER_SECONDS);
    toast.success(t("resent"));
  }

  if (phone === undefined || phone === null) return <LoginSkeleton />;
  if (status === "second-factor")
    return (
      <FactorChallenge
        onVerified={() => {
          setStatus("verified");
        }}
        onRestart={() => {
          router.replace({ pathname: "/login", query: { next } });
        }}
      />
    );

  const minutes = format.number(Math.floor(secondsLeft / 60), {
    useGrouping: false,
  });
  const seconds = format.number(secondsLeft % 60, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const countdown = ltr(`${minutes}:${seconds}`);

  const isBusy = status !== "idle" || isResending;
  const canRetry = status === "session-timeout" || status === "profile-error";

  return (
    <div className="flex flex-col gap-6">
      <AuthProgress step="code" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
          {t("verifyTitle")}
        </h1>
        <p className="text-muted-foreground">
          {t("sentTo", { phone: ltr(formatIndianMobile(phone)) })}
        </p>
        <Link
          href={{ pathname: "/login", query: { next } }}
          className="inline-flex min-h-11 max-w-full items-center self-start py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("changeNumber")}
        </Link>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canRetry) {
            setError(null);
            setStatus("verified");
          } else {
            void verify(code);
          }
        }}
      >
        <label htmlFor="code" className="text-base font-medium">
          {t("codeLabel")}
        </label>
        <div dir="ltr" className="flex justify-center">
          <InputOTP
            ref={codeInput}
            id="code"
            maxLength={CODE_LENGTH}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            disabled={isBusy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
            onChange={(value) => {
              setCode(value);
              if (value.length === CODE_LENGTH) void verify(value);
            }}
          >
            <InputOTPGroup>
              {Array.from({ length: CODE_LENGTH }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-12 w-10 text-lg sm:w-12"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {error ? (
          <p id="code-error" role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!canRetry && (isBusy || code.length !== CODE_LENGTH)}
        >
          {canRetry ? common("retry") : null}
          {status === "idle" ? t("verify") : null}
          {status === "checking" ? t("verifying") : null}
          {status === "verified" ? t("signingIn") : null}
        </Button>
      </form>

      <div className="flex justify-center" aria-live="polite">
        {secondsLeft > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("resendCountdown", {
              time: countdown,
            })}
          </p>
        ) : (
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={isBusy}
            onClick={() => {
              void resend();
            }}
          >
            {t("resend")}
          </Button>
        )}
      </div>
    </div>
  );
}
