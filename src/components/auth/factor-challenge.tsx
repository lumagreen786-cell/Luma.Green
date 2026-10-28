"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { useMounted } from "@/lib/use-mounted";

type ChallengeError = "invalid" | "expired" | "limited" | "network" | null;
function challengeError(failure: {
  code?: string;
  status?: number;
}): ChallengeError {
  if (
    failure.code === "INVALID_TWO_FACTOR_COOKIE" ||
    failure.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"
  )
    return "expired";
  return failure.status === 429 ? "limited" : "invalid";
}
function ChallengeMessage({
  error,
  id,
}: {
  error: ChallengeError;
  id: string;
}) {
  const t = useTranslations("auth");
  const security = useTranslations("accountSecurity");
  const common = useTranslations("common");
  if (!error) return null;
  const text = {
    expired: t("twoFactorExpired"),
    limited: security("errorRateLimited"),
    network: common("error"),
    invalid: security("errorCode"),
  }[error];
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {text}
    </p>
  );
}

/** Shared by public login and inline household booking; no secrets persist. */
export function FactorChallenge({
  onVerified,
  onRestart,
}: {
  onVerified: () => void;
  onRestart: () => void;
}) {
  const t = useTranslations("auth");
  const nav = useTranslations("nav");
  const id = useId();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChallengeError>(null);
  const isMounted = useMounted();
  const pending = useRef(false);

  async function verify() {
    if (
      pending.current ||
      !code.trim() ||
      (mode === "totp" && code.length !== 6)
    )
      return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "totp"
          ? await authClient.twoFactor.verifyTotp({ code, trustDevice: false })
          : await authClient.twoFactor.verifyBackupCode({
              code: code.trim(),
              trustDevice: false,
            });
      if (!isMounted()) return;
      if (!result.error) {
        onVerified();
        return;
      }
      setError(challengeError(result.error));
      setCode("");
    } catch {
      if (!isMounted()) return;
      setError("network");
    } finally {
      pending.current = false;
      if (isMounted()) setBusy(false);
    }
  }

  return (
    <section
      className="flex min-w-0 flex-col gap-6"
      aria-labelledby={`${id}-title`}
    >
      <header className="space-y-2">
        <h1
          id={`${id}-title`}
          className="font-display text-2xl leading-[1.25] font-semibold tracking-tight"
        >
          {t(mode === "totp" ? "twoFactorTitle" : "twoFactorBackupTitle")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(
            mode === "totp"
              ? "twoFactorDescription"
              : "twoFactorBackupDescription",
          )}
        </p>
      </header>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void verify();
        }}
      >
        <Label htmlFor={id}>
          {t(mode === "totp" ? "codeLabel" : "twoFactorBackupLabel")}
        </Label>
        {mode === "totp" ? (
          <div dir="ltr" className="flex justify-start rtl:justify-end">
            <InputOTP
              id={id}
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={setCode}
              disabled={busy || error === "expired"}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
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
        ) : (
          <Input
            id={id}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            disabled={busy || error === "expired"}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-12 font-mono"
          />
        )}
        <ChallengeMessage error={error} id={`${id}-error`} />
        {error === "expired" ? (
          <Button type="button" onClick={onRestart} className="min-h-11">
            {t("twoFactorRestart")}
          </Button>
        ) : (
          <Button
            type="submit"
            className="min-h-11"
            disabled={
              busy || !code.trim() || (mode === "totp" && code.length !== 6)
            }
          >
            {t(busy ? "verifying" : "verify")}
          </Button>
        )}
      </form>
      <div className="flex flex-col items-start gap-1 border-t pt-3">
        <Button
          variant="link"
          className="min-h-11 max-w-full px-0"
          disabled={busy || error === "expired"}
          onClick={() => {
            setMode(mode === "totp" ? "backup" : "totp");
            setCode("");
            setError(null);
          }}
        >
          {t(mode === "totp" ? "twoFactorUseBackup" : "twoFactorUseApp")}
        </Button>
        <Link
          href="/help/contact"
          className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4"
        >
          {nav("contact")}
        </Link>
      </div>
    </section>
  );
}
