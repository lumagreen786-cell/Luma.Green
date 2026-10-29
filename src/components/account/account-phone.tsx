"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { codeErrorKey } from "@/components/auth/errors";
import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { asciiDigits } from "@/lib/number-input";
import { requestPhoneCode } from "@/lib/phone-auth";
import { useMounted } from "@/lib/use-mounted";

import { api } from "../../../convex/_generated/api";
import { normalizeIndianMobile } from "../../../convex/lib/phone";

function usePhoneBinding(canSend: boolean) {
  const t = useTranslations("accountPhone");
  const auth = useTranslations("auth");
  const security = useTranslations("accountSecurity");
  const session = authClient.useSession();
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauthenticate, setReauthenticate] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const isMounted = useMounted();
  const sessionId = session.data?.session.id;
  const observedSession = useRef(sessionId);
  useEffect(() => {
    observedSession.current = sessionId;
  }, [sessionId]);
  const isCurrent = () => isMounted() && observedSession.current === sessionId;
  const pending = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [cooldown]);

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setReauthenticate(false);
    try {
      await action();
    } catch {
      if (!isCurrent()) return;
      setError(auth("errorGeneric"));
    } finally {
      pending.current = false;
      if (isMounted()) setBusy(false);
    }
  }
  async function send() {
    if (!canSend) return;
    const normalized = normalizeIndianMobile(asciiDigits(number));
    if (!normalized) {
      setError(auth("mobileInvalid"));
      return;
    }
    const failure = await requestPhoneCode(normalized, isCurrent);
    if (!isCurrent()) return;
    if (failure) {
      setError(auth(failure));
      return;
    }
    setPhone(normalized);
    setCode("");
    setNow(Date.now());
    setResendAt(Date.now() + 300_000);
  }
  async function verify() {
    if (!phone) return;
    const { error: failure } = await authClient.phoneNumber.verify({
      phoneNumber: phone,
      code,
      updatePhoneNumber: true,
      disableSession: true,
    });
    if (!isCurrent()) return;
    setCode("");
    if (failure) {
      if (
        failure.code === "SECURITY_REAUTH_REQUIRED" ||
        failure.status === 401
      ) {
        setError(security("recentSignIn"));
        setReauthenticate(true);
      } else if (failure.code === "PHONE_NUMBER_EXIST") setError(t("inUse"));
      else if (failure.code === "UNSUPPORTED_PHONE_ACCOUNT_CHANGE")
        setError(t("unsupported"));
      else setError(auth(codeErrorKey(failure)));
      return;
    }
    setVerified(true);
    await session.refetch();
  }
  return {
    number,
    setNumber,
    phone,
    setPhone,
    code,
    setCode,
    busy,
    error,
    setError,
    reauthenticate,
    verified: verified || session.data?.user.phoneNumberVerified,
    cooldown,
    perform,
    send,
    verify,
  };
}

function PhoneBindingForm({
  state,
  id,
  canSend,
}: {
  state: ReturnType<typeof usePhoneBinding>;
  id: string;
  canSend: boolean;
}) {
  const auth = useTranslations("auth");
  const {
    number,
    setNumber,
    phone,
    setPhone,
    code,
    setCode,
    busy,
    setError,
    reauthenticate,
    cooldown,
    perform,
    send,
    verify,
  } = state;
  const idleLabel = phone ? "verify" : "sendCode";
  const busyLabel = phone ? "verifying" : "sending";
  const label = busy ? busyLabel : idleLabel;
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void perform(phone ? verify : send);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${id}-number`}>{auth("mobileLabel")}</Label>
        <Input
          id={`${id}-number`}
          type="tel"
          autoComplete="tel"
          dir="ltr"
          value={number}
          disabled={busy || phone !== null}
          onChange={(event) => {
            setNumber(event.target.value);
          }}
        />
      </div>
      {phone ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-code`}>{auth("codeLabel")}</Label>
          <Input
            id={`${id}-code`}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            value={code}
            disabled={busy}
            onChange={(event) => {
              setCode(asciiDigits(event.target.value).replaceAll(/\D/g, ""));
            }}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            busy ||
            reauthenticate ||
            (phone === null && !canSend) ||
            (phone !== null && code.length !== 6)
          }
        >
          {auth(label)}
        </Button>
        {phone ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !canSend || cooldown > 0}
              onClick={() => {
                void perform(send);
              }}
            >
              {auth("resend")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPhone(null);
                setCode("");
                setError(null);
              }}
            >
              {auth("changeNumber")}
            </Button>
          </>
        ) : null}
      </div>
      {phone && cooldown > 0 ? (
        <p className="text-sm text-muted-foreground">
          {auth("resendIn", { seconds: cooldown })}
        </p>
      ) : null}
    </form>
  );
}

/** Bind possession to the current identity without replacing its sign-in method. */
export function AccountPhone({
  onReauthenticate,
}: {
  onReauthenticate: () => void;
}) {
  const t = useTranslations("accountPhone");
  const security = useTranslations("accountSecurity");
  const options = useSignedInQuery(api.identity.signInOptions);
  const state = usePhoneBinding(options?.phone === true);
  const id = useId();
  let content = null;
  if (state.verified)
    content = (
      <p role="status" className="text-sm font-medium">
        {t("verified")}
      </p>
    );
  else if (options?.phone || state.phone)
    content = (
      <>
        <PhoneBindingForm
          state={state}
          id={id}
          canSend={options?.phone === true}
        />
        {options?.phone === false ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("unavailable")}
          </p>
        ) : null}
      </>
    );
  else if (options !== undefined)
    content = (
      <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
    );
  return (
    <section
      className="space-y-4 border-t pt-6"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("description")}
      </p>
      {content}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.reauthenticate ? (
        <Button variant="outline" onClick={onReauthenticate}>
          {security("signInAgain")}
        </Button>
      ) : null}
    </section>
  );
}
