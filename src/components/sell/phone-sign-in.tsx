"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { LockIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type SyntheticEvent, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import type { CodeErrorKey } from "@/components/auth/errors";
import { FactorChallenge } from "@/components/auth/factor-challenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  requestPhoneCode,
  type SendCodeErrorKey,
  verifyPhoneCode,
} from "@/lib/phone-auth";

import {
  formatIndianMobile,
  normalizeIndianMobile,
} from "../../../convex/lib/phone";

const CODE_LENGTH = 6;
const RESEND_AFTER_SECONDS = 300;

/** Keeps a number reading left to right inside RTL sentences. */
function ltr(text: string): string {
  return `\u{2066}${text}\u{2069}`;
}

/**
 * A household confirms their mobile number without leaving the page: the
 * number, then the 6-digit SMS code. Households never register — the first
 * confirmed code creates their sign-in. `onVerified` runs once the code is
 * accepted; Convex sees the session a moment later (see useAuthReady).
 */
export function PhoneSignIn({
  verifyLabel,
  onVerified,
}: {
  /** The button under the code, e.g. "Confirm and book". */
  verifyLabel: string;
  onVerified: () => void;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [lastNumber, setLastNumber] = useState("");
  return phone === null ? (
    <NumberForm
      initialNumber={lastNumber}
      onSent={(number) => {
        setLastNumber(number.startsWith("+91") ? number.slice(3) : number);
        setPhone(number);
      }}
    />
  ) : (
    <CodeForm
      phone={phone}
      verifyLabel={verifyLabel}
      onChangeNumber={() => {
        setPhone(null);
      }}
      onVerified={onVerified}
    />
  );
}

function NumberForm({
  initialNumber,
  onSent,
}: {
  initialNumber: string;
  onSent: (phone: string) => void;
}) {
  const t = useTranslations("sell.phone");
  const auth = useTranslations("auth");
  const id = useId();
  const [value, setValue] = useState(initialNumber);
  const [error, setError] = useState<"invalid" | SendCodeErrorKey | null>(null);
  const [isSending, setSending] = useState(false);

  async function send(event: SyntheticEvent) {
    event.preventDefault();
    const phone = normalizeIndianMobile(value);
    if (!phone) {
      setError("invalid");
      return;
    }
    setError(null);
    setSending(true);
    const failure = await requestPhoneCode(phone);
    setSending(false);
    if (failure) {
      setError(failure);
      return;
    }
    onSent(phone);
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void send(event);
      }}
      className="flex flex-col gap-3"
    >
      <Label htmlFor={id} className="text-base">
        {t("label")}
      </Label>
      <div className="flex gap-2" dir="ltr">
        <span className="flex h-12 items-center rounded-md border bg-muted px-3 text-lg font-medium">
          +91
        </span>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          className="h-12 text-lg tracking-wide"
        />
      </div>
      <p
        id={`${id}-hint`}
        role={error ? "alert" : undefined}
        className={
          error ? "text-sm text-destructive" : "text-sm text-muted-foreground"
        }
      >
        {error === "sendRateLimited" ? auth(error) : t(error ?? "hint")}
      </p>
      <Button
        type="submit"
        size="lg"
        className="h-12 text-base"
        disabled={isSending}
      >
        {t(isSending ? "sending" : "sendCode")}
      </Button>
      <p className="flex gap-2 text-sm text-muted-foreground">
        <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t("privacy")}
      </p>
    </form>
  );
}

function CodeForm({
  phone,
  verifyLabel,
  onChangeNumber,
  onVerified,
}: {
  phone: string;
  verifyLabel: string;
  onChangeNumber: () => void;
  onVerified: () => void;
}) {
  const t = useTranslations("sell.phone");
  const format = useFormatter();
  const auth = useTranslations("auth");
  const id = useId();
  const [code, setCode] = useState("");
  const [isChecking, setChecking] = useState(false);
  const [needsFactor, setNeedsFactor] = useState(false);
  const [error, setError] = useState<CodeErrorKey | SendCodeErrorKey | null>(
    null,
  );
  const [resendAt, setResendAt] = useState(
    () => Date.now() + RESEND_AFTER_SECONDS * 1000,
  );
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS);
  const codeInput = useRef<HTMLInputElement>(null);
  const requestPending = useRef(false);
  const [isResending, setResending] = useState(false);

  // After a wrong code the boxes are cleared; put the cursor back in them.
  useEffect(() => {
    if (error) codeInput.current?.focus();
  }, [error]);

  useEffect(() => {
    const update = () => {
      const remaining = Math.ceil((resendAt - Date.now()) / 1000);
      setSecondsLeft(Math.max(0, remaining));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [resendAt]);

  async function verify(value: string) {
    if (isChecking || requestPending.current || value.length !== CODE_LENGTH)
      return;
    requestPending.current = true;
    setChecking(true);
    setError(null);
    const result = await verifyPhoneCode(phone, value);
    requestPending.current = false;
    if (result.kind === "error") {
      setChecking(false);
      setCode("");
      setError(result.error);
      return;
    }
    if (result.kind === "second-factor") {
      setNeedsFactor(true);
      return;
    }
    onVerified();
  }

  async function resend() {
    if (isChecking || requestPending.current || Date.now() < resendAt) return;
    requestPending.current = true;
    setResending(true);
    setError(null);
    const failure = await requestPhoneCode(phone);
    requestPending.current = false;
    setResending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setResendAt(Date.now() + RESEND_AFTER_SECONDS * 1000);
    setSecondsLeft(RESEND_AFTER_SECONDS);
    toast.success(t("resent"));
  }

  if (needsFactor)
    return (
      <FactorChallenge onVerified={onVerified} onRestart={onChangeNumber} />
    );

  const minutes = format.number(Math.floor(secondsLeft / 60), {
    useGrouping: false,
  });
  const seconds = format.number(secondsLeft % 60, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const countdown = ltr(`${minutes}:${seconds}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-muted-foreground">
          {t("sentTo", { phone: ltr(formatIndianMobile(phone)) })}
        </p>
        <Button
          type="button"
          variant="link"
          className="h-11 px-0"
          onClick={onChangeNumber}
        >
          {t("changeNumber")}
        </Button>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void verify(code);
        }}
      >
        <label htmlFor={id} className="text-base font-medium">
          {t("codeLabel")}
        </label>
        <div dir="ltr" className="flex justify-center sm:justify-start">
          <InputOTP
            ref={codeInput}
            id={id}
            maxLength={CODE_LENGTH}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            // The code field is the only thing to do here, right after
            // tapping "Send code".

            autoFocus
            value={code}
            disabled={isChecking || isResending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
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
                  className="h-12 w-10 text-xl sm:w-12"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {error ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {error === "sendRateLimited" ? auth(error) : t(error)}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="h-12 text-base"
          disabled={isChecking || isResending || code.length !== CODE_LENGTH}
        >
          {isChecking ? t("verifying") : verifyLabel}
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
            type="button"
            variant="ghost"
            disabled={isChecking || isResending}
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
