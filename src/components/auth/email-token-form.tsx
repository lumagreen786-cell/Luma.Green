"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

import { emailErrorKey } from "./email-form";

/** Explicit submission avoids consuming mail links in a link-preview request. */
export function EmailTokenForm({ reset = false }: { reset?: boolean }) {
  const t = useTranslations("emailAuth");
  const common = useTranslations("common");
  const params = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);
  async function submit() {
    if (pending.current) return;
    if (!token) {
      setError("invalidLink");
      return;
    }
    if (!isConvexConfigured) {
      setError("unavailable");
      return;
    }
    if (reset && password !== confirm) {
      setError("mismatch");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = reset
        ? await authClient.resetPassword({ token, newPassword: password })
        : await authClient.verifyEmail({ query: { token } });
      if (result.error) setError(emailErrorKey(result.error));
      else {
        setDone(true);
        setPassword("");
        setConfirm("");
      }
    } catch {
      setError("failed");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const actionLabel = t(reset ? "reset" : "verify");
  const submitLabel = busy ? common("loading") : actionLabel;
  return (
    <section className="flex min-w-0 flex-col gap-6">
      <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
        {t(reset ? "reset" : "verify")}
      </h1>
      {done ? (
        <p role="status">{t("done")}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {reset ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("password")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                  disabled={busy}
                />
                <p className="text-sm text-muted-foreground">
                  {t("passwordHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("confirm")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(event) => {
                    setConfirm(event.target.value);
                  }}
                  disabled={busy}
                />
              </div>
            </>
          ) : null}
          {error || !token ? (
            <p role="alert" className="text-sm text-destructive">
              {t(error ?? "invalidLink")}
            </p>
          ) : null}
          <Button size="lg" disabled={busy || !token || !isConvexConfigured}>
            {submitLabel}
          </Button>
        </form>
      )}
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
      >
        {t("signin")}
      </Link>
    </section>
  );
}
