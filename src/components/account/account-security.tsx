"use client";

import { ShieldCheckIcon, ShieldIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import { AppPageHeader } from "@/components/app/page-parts";
import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { signOutWithDeviceRevocation } from "@/lib/sign-out";
import { useMounted } from "@/lib/use-mounted";

import { api } from "../../../convex/_generated/api";
import { PHONE_EMAIL_DOMAIN } from "../../../convex/lib/phone";
import { AccountPhone } from "./account-phone";

interface Enrollment {
  totpURI: string;
  backupCodes: string[];
}
type SecurityError =
  "recentSignIn" | "errorCode" | "errorRateLimited" | "generic";

function securityError(error: {
  code?: string;
  status?: number;
}): SecurityError {
  if (error.code === "SECURITY_REAUTH_REQUIRED" || error.status === 401)
    return "recentSignIn";
  return error.status === 429 ? "errorRateLimited" : "generic";
}

/** A different identity must never inherit another person's secret form state. */
export function AccountSecurity() {
  const session = authClient.useSession();
  return <SecurityForm key={session.data?.user.id} />;
}

/** Secret values are held only in this mounted form, never browser storage. */
function SecurityForm() {
  const isMounted = useMounted();
  const t = useTranslations("accountSecurity");
  const common = useTranslations("common");
  const person = useSignedInQuery(api.identity.me);
  const router = useRouter();
  const session = authClient.useSession();
  const sessionId = session.data?.session.id;
  const currentSessionId = useRef(sessionId);
  useEffect(() => {
    currentSessionId.current = sessionId;
  }, [sessionId]);
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<Enrollment | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SecurityError | null>(null);
  const [confirmation, setConfirmation] = useState<
    "disable" | "regenerate" | null
  >(null);
  const pending = useRef(false);
  const credentials = person?.hasPassword ? { password } : {};

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      if (!isMounted()) return;
      setError("generic");
    } finally {
      pending.current = false;
      if (isMounted()) {
        setBusy(false);
        setPassword("");
      }
    }
  }

  async function enable() {
    const { data, error: failure } =
      await authClient.twoFactor.enable(credentials);
    if (!isMounted()) return;
    if (failure) {
      setError(securityError(failure));
      return;
    }
    setSetup(data);
    setCode("");
  }

  async function verify() {
    const { error: failure } = await authClient.twoFactor.verifyTotp({ code });
    if (!isMounted()) return;
    if (failure) {
      setError(
        failure.code === "INVALID_CODE" ? "errorCode" : securityError(failure),
      );
      setCode("");
      return;
    }
    setCodes(setup?.backupCodes ?? null);
    setSetup(null);
    setCode("");
  }

  async function changeProtection() {
    if (confirmation === "regenerate") {
      const { data, error: failure } =
        await authClient.twoFactor.generateBackupCodes(credentials);
      if (!isMounted()) return;
      if (failure) setError(securityError(failure));
      else setCodes(data.backupCodes);
    } else {
      const { error: failure } =
        await authClient.twoFactor.disable(credentials);
      if (!isMounted()) return;
      if (failure) setError(securityError(failure));
    }
    setConfirmation(null);
  }

  async function signInAgain() {
    await signOutWithDeviceRevocation(
      sessionId,
      () => isMounted() && currentSessionId.current === sessionId,
    );
    if (!isMounted() || currentSessionId.current !== sessionId) return;
    router.replace({
      pathname: "/login",
      query: { next: "/account/security" },
    });
  }

  if (person === undefined) return <Skeleton className="h-40 w-full" />;
  if (!person)
    return (
      <Link href={{ pathname: "/login", query: { next: "/account/security" } }}>
        {t("signInAgain")}
      </Link>
    );
  const isEnabled = person.twoFactorEnabled;
  const StatusIcon = isEnabled ? ShieldCheckIcon : ShieldIcon;
  const actionLabel = t(confirmation === "disable" ? "disable" : "regenerate");

  return (
    <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6">
      <AppPageHeader
        title={t("title")}
        lead={<SecurityHelp hasPassword={person.hasPassword} />}
      />
      <div className="flex flex-wrap items-center gap-3 py-2">
        <StatusIcon
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-primary"
        />
        <span className="min-w-0 font-medium">{t("setupTitle")}</span>
        <span className="ms-auto shrink-0 text-sm text-muted-foreground">
          {t(isEnabled ? "enabled" : "disabled")}
        </span>
      </div>
      <SecurityPassword
        active={
          person.hasPassword &&
          !isEnabled &&
          person.kind !== "admin" &&
          !setup &&
          !codes
        }
        password={password}
        onPassword={setPassword}
        busy={busy}
      />
      <SecurityContent
        setup={setup}
        codes={codes}
        code={code}
        busy={busy}
        error={error}
        isEnabled={isEnabled}
        isAdmin={person.kind === "admin"}
        hasPassword={person.hasPassword}
        onCode={setCode}
        onVerify={() => {
          void perform(verify);
        }}
        onEnable={() => {
          void perform(enable);
        }}
        onChange={setConfirmation}
        onDismiss={() => {
          setSetup(null);
          setCodes(null);
          setCode("");
          setError(null);
        }}
      />
      {error ? (
        <div className="space-y-3">
          <p
            id="security-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {error === "generic" ? common("error") : t(error)}
          </p>
          {error === "recentSignIn" ? (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                void perform(signInAgain);
              }}
            >
              {t("signInAgain")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <SecurityFooter hasPassword={person.hasPassword} />
      {!setup &&
      !codes &&
      person.kind !== "admin" &&
      session.data?.user.emailVerified &&
      !session.data.user.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? (
        <AccountPhone
          onReauthenticate={() => {
            void perform(signInAgain);
          }}
        />
      ) : null}
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
      >
        <DialogContent closeLabel={common("close")}>
          <DialogHeader>
            <DialogTitle>
              {t(confirmation === "disable" ? "disable" : "backupTitle")}
            </DialogTitle>
            <DialogDescription>
              <SecurityChangeDescription
                isDisabling={confirmation === "disable"}
                hasPassword={person.hasPassword}
              />
            </DialogDescription>
          </DialogHeader>
          <SecurityPassword
            active={person.hasPassword}
            password={password}
            onPassword={setPassword}
            busy={busy}
            inDialog
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setConfirmation(null);
              }}
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                void perform(changeProtection);
              }}
            >
              {busy ? common("loading") : actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SetupKey({ uri, label }: { uri: string; label: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const secret = new URL(uri).searchParams.get("secret");
  useEffect(() => {
    let isActive = true;
    async function generate() {
      try {
        const value = await QRCode.toDataURL(uri, { width: 208, margin: 1 });
        if (isActive) setQr(value);
      } catch {
        if (isActive) setQr(null);
      }
    }
    void generate();
    return () => {
      isActive = false;
    };
  }, [uri]);
  return (
    <div className="flex flex-col items-start gap-3 border-y py-4">
      {qr ? (
        <Image src={qr} alt="" width={208} height={208} unoptimized />
      ) : null}
      <p className="text-sm text-muted-foreground">{label}</p>
      <code
        dir="ltr"
        className="max-w-full font-mono text-sm break-all select-all"
      >
        {secret}
      </code>
    </div>
  );
}

interface SecurityContentProps {
  setup: Enrollment | null;
  codes: string[] | null;
  code: string;
  busy: boolean;
  error: SecurityError | null;
  isEnabled: boolean;
  isAdmin: boolean;
  hasPassword: boolean;
  onCode: (value: string) => void;
  onVerify: () => void;
  onEnable: () => void;
  onChange: (action: "disable" | "regenerate") => void;
  onDismiss: () => void;
}

function SecurityContent(props: SecurityContentProps) {
  if (props.setup) return <EnrollmentForm {...props} setup={props.setup} />;
  if (props.codes)
    return (
      <RecoveryCodes
        codes={props.codes}
        onDismiss={props.onDismiss}
        hasPassword={props.hasPassword}
      />
    );
  return props.isAdmin ? null : <SecurityActions {...props} />;
}

function SecurityActions({
  isEnabled,
  busy,
  onEnable,
  onChange,
}: Pick<SecurityContentProps, "isEnabled" | "busy" | "onEnable" | "onChange">) {
  const t = useTranslations("accountSecurity");
  const common = useTranslations("common");
  if (!isEnabled)
    return (
      <Button className="min-h-11" disabled={busy} onClick={onEnable}>
        {busy ? common("loading") : t("enable")}
      </Button>
    );
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        variant="outline"
        className="min-h-11"
        disabled={busy}
        onClick={() => {
          onChange("regenerate");
        }}
      >
        {t("regenerate")}
      </Button>
      <Button
        variant="ghost"
        className="min-h-11"
        disabled={busy}
        onClick={() => {
          onChange("disable");
        }}
      >
        {t("disable")}
      </Button>
    </div>
  );
}

function RecoveryCodes({
  hasPassword,
  codes,
  onDismiss,
}: {
  codes: string[];
  hasPassword: boolean;
  onDismiss: () => void;
}) {
  const t = useTranslations("accountSecurity");
  const emailCopy = useTranslations("emailAuth");
  return (
    <section className="flex flex-col gap-4" aria-labelledby="recovery-title">
      <h2 id="recovery-title" className="text-lg font-semibold">
        {t("backupTitle")}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {hasPassword ? emailCopy("backupHint") : t("backupDescription")}
      </p>
      <ul
        dir="ltr"
        className="grid grid-cols-1 gap-x-6 gap-y-2 border-y py-4 font-mono text-sm select-all min-[360px]:grid-cols-2"
      >
        {codes.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
      <Button className="min-h-11" onClick={onDismiss}>
        {t("savedCodes")}
      </Button>
    </section>
  );
}

function EnrollmentForm({
  setup,
  code,
  busy,
  error,
  onCode,
  onVerify,
  onDismiss,
}: Pick<
  SecurityContentProps,
  "code" | "busy" | "error" | "onCode" | "onVerify" | "onDismiss"
> & { setup: Enrollment }) {
  const t = useTranslations("accountSecurity");
  const auth = useTranslations("auth");
  const common = useTranslations("common");
  return (
    <section className="flex flex-col gap-4" aria-labelledby="setup-title">
      <h2 id="setup-title" className="text-lg font-semibold">
        {t("setupTitle")}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("setupDescription")}
      </p>
      <SetupKey uri={setup.totpURI} label={t("setupKey")} />
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onVerify();
        }}
      >
        <Label htmlFor="authenticator-code">{auth("codeLabel")}</Label>
        <Input
          id="authenticator-code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => {
            onCode(event.target.value.replaceAll(/\D/g, ""));
          }}
          aria-invalid={error === "errorCode"}
          aria-describedby={error ? "security-error" : undefined}
          disabled={busy}
          className="h-12 font-mono text-lg tracking-widest"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            disabled={busy || code.length !== 6}
            className="min-h-11"
          >
            {busy ? common("loading") : auth("verify")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            className="min-h-11"
            onClick={onDismiss}
          >
            {common("cancel")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function SecurityFooter({ hasPassword }: { hasPassword: boolean }) {
  const nav = useTranslations("nav");
  return (
    <footer className="space-y-2 border-t pt-4">
      {hasPassword ? null : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          <SecurityHelp hasPassword={false} recovery />
        </p>
      )}
      <Link
        href="/help/contact"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        {nav("contact")}
      </Link>
    </footer>
  );
}

function SecurityHelp({
  hasPassword,
  recovery = false,
}: {
  hasPassword: boolean;
  recovery?: boolean;
}) {
  const t = useTranslations("accountSecurity");
  const emailCopy = useTranslations("emailAuth");
  if (hasPassword) return emailCopy("securityHint");
  return t(recovery ? "recoveryHelp" : "description");
}

function SecurityChangeDescription({
  isDisabling,
  hasPassword,
}: {
  isDisabling: boolean;
  hasPassword: boolean;
}) {
  const t = useTranslations("accountSecurity");
  const emailCopy = useTranslations("emailAuth");
  if (isDisabling && hasPassword) return emailCopy("disableHint");
  return t(isDisabling ? "disableDescription" : "regenerateDescription");
}

function SecurityPassword({
  active,
  password,
  onPassword,
  busy,
  inDialog = false,
}: {
  active: boolean;
  password: string;
  onPassword: (value: string) => void;
  busy: boolean;
  inDialog?: boolean;
}) {
  const t = useTranslations("emailAuth");
  if (!active) return null;
  const id = inDialog ? "security-confirm-password" : "security-password";
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("password")}</Label>
      <Input
        id={id}
        type="password"
        autoComplete="current-password"
        maxLength={128}
        value={password}
        onChange={(event) => {
          onPassword(event.target.value);
        }}
        disabled={busy}
      />
    </div>
  );
}
