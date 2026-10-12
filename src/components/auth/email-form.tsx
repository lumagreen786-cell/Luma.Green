"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/safe-next";

import { FactorChallenge } from "./factor-challenge";

export function emailErrorKey(error: { code?: string; status?: number }) {
  if (error.status === 429) return "limited";
  if (error.code === "EMAIL_NOT_VERIFIED") return "unverified";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "credentials";
  if (error.code === "INVALID_TOKEN" || error.code === "TOKEN_EXPIRED")
    return "invalidLink";
  return error.status === 503 ? "unavailable" : "failed";
}

type EmailMode = "signin" | "signup" | "forgot";
type EmailAction = EmailMode | "resend";
interface EmailFields {
  email: string;
  password: string;
  name: string;
}
type EmailResult =
  | { kind: "sent" | "factor" | "signed-in" }
  | { kind: "error"; error: ReturnType<typeof emailErrorKey> };

async function requestEmailAction(
  action: EmailAction,
  fields: EmailFields,
  locale: string,
): Promise<EmailResult> {
  if (action === "signin") {
    const result = await authClient.signIn.email({
      email: fields.email,
      password: fields.password,
    });
    if (result.error)
      return { kind: "error", error: emailErrorKey(result.error) };
    if ("twoFactorRedirect" in result.data && result.data.twoFactorRedirect)
      return { kind: "factor" };
    return "token" in result.data && result.data.token
      ? { kind: "signed-in" }
      : { kind: "error", error: "failed" };
  }
  const fetchOptions = { headers: { "x-luma-locale": locale } };
  let result;
  switch (action) {
    case "signup": {
      result = await authClient.signUp.email({ ...fields, fetchOptions });
      break;
    }
    case "forgot": {
      result = await authClient.requestPasswordReset({
        email: fields.email,
        fetchOptions,
      });
      break;
    }
    case "resend": {
      result = await authClient.sendVerificationEmail({
        email: fields.email,
        fetchOptions,
      });
      break;
    }
  }
  return result.error
    ? { kind: "error", error: emailErrorKey(result.error) }
    : { kind: "sent" };
}

/** Credentials stay only in this mounted form. No secret enters browser storage. */
export function EmailForm({ canSend }: { canSend: boolean }) {
  const t = useTranslations("emailAuth");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState(false);
  const [error, setError] = useState<ReturnType<typeof emailErrorKey> | null>(
    null,
  );
  const [sent, setSent] = useState(false);
  const pending = useRef(false);
  const finish = () => {
    router.replace({
      pathname: "/login/email/complete",
      query: { next: safeNextPath(params.get("next"), "/app") },
    });
  };

  async function submit(action: EmailAction = mode) {
    if (pending.current) return;
    if (!isConvexConfigured || (!canSend && action !== "signin")) {
      setError("unavailable");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await requestEmailAction(
        action,
        { email, password, name },
        locale,
      );
      if (result.kind === "error") {
        setError(result.error);
        return;
      }
      setPassword("");
      switch (result.kind) {
        case "sent": {
          setSent(true);
          break;
        }
        case "factor": {
          setFactor(true);
          break;
        }
        case "signed-in": {
          finish();
          break;
        }
      }
    } catch {
      setError("failed");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (factor)
    return (
      <FactorChallenge
        onVerified={finish}
        onRestart={() => {
          setFactor(false);
          setError(null);
        }}
      />
    );
  return (
    <section className="flex min-w-0 flex-col gap-6">
      <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
        {t(mode)}
      </h1>
      {canSend ? null : (
        <p role="status" className="text-sm text-muted-foreground">
          {t("unavailable")}
        </p>
      )}
      {sent ? (
        <p role="status" className="text-sm leading-relaxed">
          {t("sent")}
        </p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <CredentialFields
            mode={mode}
            busy={busy}
            email={email}
            name={name}
            password={password}
            onEmail={setEmail}
            onName={setName}
            onPassword={setPassword}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {t(error)}
            </p>
          ) : null}
          <Button
            size="lg"
            disabled={
              busy || !isConvexConfigured || (mode !== "signin" && !canSend)
            }
          >
            {busy ? common("loading") : t(mode)}
          </Button>
          {error === "unverified" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || !canSend}
              onClick={() => {
                void submit("resend");
              }}
            >
              {t("resend")}
            </Button>
          ) : null}
        </form>
      )}
      <div className="flex flex-col items-start gap-1 border-t pt-3">
        {(["signin", "signup", "forgot"] as const)
          .filter((item) => item !== mode || sent)
          .map((item) => (
            <Button
              key={item}
              variant="link"
              className="max-w-full px-0"
              disabled={busy}
              onClick={() => {
                setMode(item);
                setError(null);
                setSent(false);
                setPassword("");
              }}
            >
              {t(item)}
            </Button>
          ))}
      </div>
    </section>
  );
}

function CredentialFields({
  mode,
  busy,
  email,
  name,
  password,
  onEmail,
  onName,
  onPassword,
}: EmailFields & {
  mode: EmailMode;
  busy: boolean;
  onEmail: (value: string) => void;
  onName: (value: string) => void;
  onPassword: (value: string) => void;
}) {
  const t = useTranslations("emailAuth");
  const [visible, setVisible] = useState(false);
  return (
    <>
      {mode === "signup" ? (
        <div className="space-y-2">
          <Label htmlFor="email-name">{t("name")}</Label>
          <Input
            id="email-name"
            autoComplete="name"
            maxLength={100}
            required
            value={name}
            onChange={(event) => {
              onName(event.target.value);
            }}
            disabled={busy}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email-address">{t("email")}</Label>
        <Input
          id="email-address"
          type="email"
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          maxLength={254}
          required
          value={email}
          onChange={(event) => {
            onEmail(event.target.value);
          }}
          disabled={busy}
        />
      </div>
      {mode === "forgot" ? null : (
        <div className="space-y-2">
          <Label htmlFor="email-password">{t("password")}</Label>
          <div className="relative">
            <Input
              id="email-password"
              type={visible ? "text" : "password"}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={mode === "signup" ? 12 : 1}
              maxLength={128}
              required
              value={password}
              onChange={(event) => {
                onPassword(event.target.value);
              }}
              disabled={busy}
              className="pe-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 end-0"
              aria-label={t(visible ? "hide" : "show")}
              aria-pressed={visible}
              onClick={() => {
                setVisible(!visible);
              }}
            >
              {visible ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
            </Button>
          </div>
          {mode === "signup" ? (
            <p className="text-sm text-muted-foreground">{t("passwordHint")}</p>
          ) : null}
        </div>
      )}
    </>
  );
}
