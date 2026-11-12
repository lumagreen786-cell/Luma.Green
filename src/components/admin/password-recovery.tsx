"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

import { PasswordInput } from "./password-input";

function recoveryError(error: { code?: string; status?: number }) {
  if (error.code === "ADMIN_RECOVERY_UNAVAILABLE")
    return "Email recovery is not configured yet. Contact the platform owner to set it up.";
  if (error.code === "ADMIN_RECOVERY_DELIVERY_FAILED")
    return "We could not confirm email delivery. Please try again later.";
  if (error.status === 429)
    return "Too many attempts. Please wait before trying again.";
  return error.code === "INVALID_TOKEN"
    ? "This reset link is invalid or has expired. Request a new link."
    : "We could not complete this request. Please try again.";
}

function resetValidation(token: string, password: string, confirm: string) {
  if (!token)
    return "This reset link is missing its token. Request a new link.";
  if (password !== confirm) return "The passwords do not match.";
  return password.length < 12 || password.length > 128
    ? "Use between 12 and 128 characters."
    : null;
}

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const params = useSearchParams();
  // The reset token stays in memory. Remove it from the address bar once the
  // client has read it so later navigation cannot send it in a Referer header.
  const [token] = useState(() => params.get("token") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const submitLabel = reset ? "Update password" : "Send reset link";
  useEffect(() => {
    if (reset && token)
      window.history.replaceState(null, "", "/admin/reset-password");
  }, [reset, token]);

  async function submit() {
    if (pending.current) return;
    const validation = reset ? resetValidation(token, password, confirm) : null;
    if (validation) {
      setError(validation);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = reset
        ? await authClient.resetPassword({ token, newPassword: password })
        : await authClient.requestPasswordReset({
            email,
            redirectTo: `${window.location.origin}/admin/reset-password`,
          });
      if (result.error) {
        setError(recoveryError(result.error));
        return;
      }
      setPassword("");
      setConfirm("");
      setDone(true);
      if (reset) window.history.replaceState(null, "", "/admin/reset-password");
    } catch {
      setError("Connection lost. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {done ? (
        <p role="status" className="text-sm leading-relaxed">
          {reset
            ? "Your password is updated and previous sessions are signed out. Your authenticator is still required when you sign in."
            : "If this address belongs to the configured admin account, check its inbox for a reset link. The link expires in 15 minutes."}
        </p>
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
                <Label htmlFor="new-password">New password</Label>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                  showStrength
                  disabled={busy}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Password again</Label>
                <PasswordInput
                  id="confirm-password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => {
                    setConfirm(event.target.value);
                  }}
                  disabled={busy}
                  required
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Admin email</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                disabled={busy}
                required
                className="h-12"
              />
            </div>
          )}
          {error || (reset && !token) ? (
            <p role="alert" className="text-sm text-destructive">
              {error ??
                "This reset link is missing its token. Request a new link."}
            </p>
          ) : null}
          <Button
            type="submit"
            className="min-h-12"
            disabled={busy || (reset && !token)}
          >
            {busy ? "Please wait…" : submitLabel}
          </Button>
        </form>
      )}
      {reset && !done ? (
        <p className="text-sm text-muted-foreground">
          Resetting your password does not remove your authenticator. Keep your
          authenticator or a recovery code ready.
        </p>
      ) : null}
      <div className="flex flex-col items-start gap-1">
        <Link
          href="/admin/login"
          className="inline-flex min-h-11 items-center text-sm font-medium text-foreground underline underline-offset-4"
        >
          Back to sign-in
        </Link>
        {reset ? (
          <Link
            href="/admin/forgot-password"
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4"
          >
            Request a new reset link
          </Link>
        ) : null}
      </div>
    </div>
  );
}
