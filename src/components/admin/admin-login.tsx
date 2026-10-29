"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/phone-auth";
import { useMounted } from "@/lib/use-mounted";

import { api } from "../../../convex/_generated/api";
import { normalizeIndianMobile } from "../../../convex/lib/phone";
import { AdminUnavailable } from "./admin-unavailable";
import { CODE_LENGTH, CodeInput } from "./code-input";
import { codeErrorMessage } from "./errors";

/** `/admin/login`: phone OTP, then the authenticator code. */
export function AdminLogin() {
  return isConvexConfigured ? <LoginSteps /> : <AdminUnavailable />;
}

function LoginSteps() {
  const router = useRouter();
  const me = useQuery(api.identity.me);
  const options = useQuery(api.identity.signInOptions);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [notice, setNotice] = useState<string | null>(null);

  // Already signed in? Straight to the console.
  useEffect(() => {
    if (me?.kind === "admin" && me.twoFactorEnabled) router.replace("/admin");
  }, [me, router]);

  return step === "phone" ? (
    <div className="flex flex-col gap-6">
      {notice ? (
        <p role="status" className="text-sm text-destructive">
          {notice}
        </p>
      ) : null}
      <PhoneStep
        canSend={options?.phone}
        onTwoFactor={() => {
          setNotice(null);
          setStep("code");
        }}
        onNoAuthenticator={() => {
          router.replace("/admin/setup");
        }}
      />
      {options?.adminSetup ? (
        <p className="text-sm text-muted-foreground">
          First time here?{" "}
          <Link
            href="/admin/setup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Set up the admin account
          </Link>
        </p>
      ) : null}
    </div>
  ) : (
    <CodeStep
      onDone={() => {
        router.replace("/admin");
      }}
      onRestart={(message) => {
        setNotice(message ?? null);
        setStep("phone");
      }}
    />
  );
}

function PhoneStep({
  canSend,
  onTwoFactor,
  onNoAuthenticator,
}: {
  canSend: boolean | undefined;
  onTwoFactor: () => void;
  onNoAuthenticator: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const isMounted = useMounted();
  const pending = useRef(false);
  useEffect(() => {
    if (!sent) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [sent]);
  async function send() {
    if (!canSend || pending.current || Date.now() < retryAt) return;
    const normalized = normalizeIndianMobile(phone);
    if (!normalized) {
      setError("Enter a valid Indian mobile number.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    const failure = await requestPhoneCode(normalized, isMounted);
    if (!isMounted()) return;
    pending.current = false;
    setBusy(false);
    if (failure) {
      setError(
        failure === "sendRateLimited"
          ? "Send limit reached. Wait before requesting another code. After five sends, wait 24 hours."
          : "Could not send the code. Try again later.",
      );
      return;
    }
    setPhone(normalized);
    setCode("");
    setSent(true);
    setNow(Date.now());
    setRetryAt(Date.now() + 300_000);
  }
  async function verify() {
    if (pending.current || code.length !== CODE_LENGTH) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const result = await verifyPhoneCode(phone, code);
    if (!isMounted()) return;
    pending.current = false;
    setBusy(false);
    if (result.kind === "second-factor") onTwoFactor();
    else if (result.kind === "authenticated") onNoAuthenticator();
    else {
      setCode("");
      setError(
        "The code could not be verified. Check the code and its five-minute expiry.",
      );
    }
  }
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void (sent ? verify() : send());
      }}
    >
      {canSend === false ? (
        <p role="status">SMS sign-in is unavailable. Try again later.</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-phone">Mobile number</Label>
        <Input
          id="admin-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          disabled={busy || sent}
          onChange={(event) => {
            setPhone(event.target.value);
          }}
        />
      </div>
      {sent ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-sms-code">Code from your SMS</Label>
          <CodeInput
            id="admin-sms-code"
            value={code}
            onChange={setCode}
            onComplete={setCode}
            disabled={busy}
            invalid={Boolean(error)}
          />
          <p className="text-sm text-muted-foreground">
            The code is valid for five minutes.
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={
          busy || (!sent && !canSend) || (sent && code.length !== CODE_LENGTH)
        }
      >
        {busy ? "Checking…" : null}
        {!busy && sent ? "Verify phone" : null}
        {!busy && !sent ? "Send code" : null}
      </Button>
      {sent ? (
        <Button
          type="button"
          variant="ghost"
          disabled={!canSend || busy || now < retryAt}
          onClick={() => {
            void send();
          }}
        >
          {now < retryAt
            ? `Resend in ${String(Math.ceil((retryAt - now) / 1000))} seconds`
            : "Resend code"}
        </Button>
      ) : null}
    </form>
  );
}

function CodeStep({
  onDone,
  onRestart,
}: {
  onDone: () => void;
  onRestart: (message?: string) => void;
}) {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useMounted();
  const checking = useRef(false);

  async function check(value: string) {
    if (checking.current) return;
    checking.current = true;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } =
        mode === "totp"
          ? await authClient.twoFactor.verifyTotp({ code: value })
          : await authClient.twoFactor.verifyBackupCode({ code: value });
      if (!isMounted()) return;
      if (!authError) {
        onDone();
        return;
      }
      const { message, restart } = codeErrorMessage(authError);
      if (restart) {
        onRestart(message);
        return;
      }
      setCode("");
      setError(message);
    } catch {
      if (!isMounted()) return;
      setCode("");
      setError(codeErrorMessage({}).message);
    } finally {
      checking.current = false;
      if (isMounted()) setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void check(mode === "totp" ? code : backupCode.trim());
      }}
    >
      {mode === "totp" ? (
        <div className="flex flex-col gap-3">
          <Label htmlFor="totp">Code from your authenticator app</Label>
          <CodeInput
            id="totp"
            value={code}
            onChange={setCode}
            onComplete={(value) => {
              void check(value);
            }}
            disabled={busy}
            invalid={Boolean(error)}
            describedBy={error ? "code-error" : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="backup">Backup code</Label>
          <Input
            id="backup"
            disabled={busy}
            autoComplete="one-time-code"
            spellCheck={false}
            className="font-mono"
            value={backupCode}
            onChange={(event) => {
              setBackupCode(event.target.value);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
          />
          <p className="text-sm text-muted-foreground">
            Each backup code works once.
          </p>
        </div>
      )}
      {error ? (
        <p id="code-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={
          busy ||
          (mode === "totp"
            ? code.length !== CODE_LENGTH
            : backupCode.trim() === "")
        }
      >
        {busy ? "Checking…" : "Sign in"}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
        <Button
          type="button"
          variant="link"
          className="px-0"
          disabled={busy}
          onClick={() => {
            setMode(mode === "totp" ? "backup" : "totp");
            setError(null);
          }}
        >
          {mode === "totp" ? "Use a backup code" : "Use the authenticator app"}
        </Button>
        <Button
          type="button"
          variant="link"
          className="px-0"
          disabled={busy}
          onClick={() => {
            onRestart();
          }}
        >
          Start again
        </Button>
      </div>
    </form>
  );
}
