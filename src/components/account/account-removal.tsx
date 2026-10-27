"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { beginSignOutLifecycle } from "@/lib/sign-out-lifecycle";

import { api } from "../../../convex/_generated/api";
import { useSignOut } from "./use-sign-out";

type Status = FunctionReturnType<typeof api.accountRemoval.status>;
const reasons = {
  admin_replacement: "adminReplacement",
  business_owner: "businessOwner",
  active_collection: "activeCollection",
  assigned_work: "assignedWork",
  review_limit: "reviewLimit",
} as const;
function reasonKey(code: string) {
  return Object.hasOwn(reasons, code)
    ? reasons[code as keyof typeof reasons]
    : "unavailable";
}
function failure(error: unknown) {
  const code: unknown = error instanceof ConvexError ? error.data : undefined;
  if (typeof code !== "string") return "ambiguous";
  if (code === "RECENT_FULL_AUTH_REQUIRED") return "reauth";
  if (
    [
      "INVALID_OPERATION_KEY",
      "OPERATION_CONFLICT",
      "REMOVAL_UNAVAILABLE",
      "NOT_SIGNED_IN",
      "NO_PROFILE",
    ].includes(code)
  )
    return "unavailable";
  return "ambiguous";
}

/** Unmount before closure: a closed account cannot keep a private subscription. */
function RemovalStatus({
  onStatus,
}: {
  onStatus: (status: Status | null | undefined) => void;
}) {
  const status = useSignedInQuery(api.accountRemoval.status);
  useEffect(() => {
    onStatus(status);
  }, [onStatus, status]);
  return null;
}

export function AccountRemoval() {
  const session = authClient.useSession();
  return (
    <RemovalForAccount
      key={`${session.data?.user.id ?? "signed-out"}:${session.data?.session.id ?? "no-session"}`}
      sessionId={session.data?.session.id}
    />
  );
}

/** Server closure has already revoked device authority; suppress only this session's private subscriptions. */
function useClosedAccountSignOut(sessionId: string | undefined) {
  const router = useRouter();
  const attempt = useRef<ReturnType<typeof beginSignOutLifecycle> | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState(false);
  useEffect(
    () => () => {
      attempt.current?.fail();
      attempt.current = null;
    },
    [],
  );
  async function leaveClosedAccount() {
    if (attempt.current) return;
    const lifecycle = beginSignOutLifecycle(sessionId);
    attempt.current = lifecycle;
    setLeaving(true);
    setLeaveError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("SIGN_OUT_FAILED");
      if (attempt.current !== lifecycle) return;
      lifecycle.complete();
      router.replace("/login");
    } catch {
      lifecycle.fail();
      if (attempt.current === lifecycle) setLeaveError(true);
    } finally {
      if (attempt.current === lifecycle) {
        attempt.current = null;
        setLeaving(false);
      }
    }
  }
  return { leaveClosedAccount, leaving, leaveError };
}

function useRemovalForm(sessionId: string | undefined) {
  const { leaveClosedAccount, leaving, leaveError } =
    useClosedAccountSignOut(sessionId);
  const router = useRouter();
  const close = useMutation(api.accountRemoval.close);
  const [status, setStatus] = useState<Status | null | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<
    "ambiguous" | "unavailable" | "reauth" | null
  >(null);
  const [held, setHeld] = useState<string[]>([]);
  const operationKey = useRef<string | null>(null);
  const active = useRef(true);
  const running = useRef(false);
  const { signOut, busy } = useSignOut(() => {
    router.replace("/login?next=%2Faccount%2Fremoval");
  });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function submit() {
    if (!confirmed || running.current || !status?.recentAuth) return;
    running.current = true;
    setPending(true);
    setError(null);
    operationKey.current ??= crypto.randomUUID();
    try {
      const result = await close({
        operationKey: operationKey.current,
        confirm: true,
      });
      if (!active.current) return;
      setConfirmed(false);
      if (result.state === "held") setHeld(result.reasons);
      else {
        setClosed(true);
        await leaveClosedAccount();
      }
    } catch (error_) {
      if (!active.current) return;
      const kind = failure(error_);
      setError(kind);
      if (kind !== "ambiguous") {
        operationKey.current = null;
        setConfirmed(false);
      }
    } finally {
      running.current = false;
      if (active.current) setPending(false);
    }
  }
  const isClosed = Boolean(closed || (status && status.state !== "open"));
  const heldReasons = [...new Set([...held, ...(status?.heldReasons ?? [])])];
  const isAdmin = heldReasons.includes("admin_replacement");
  const isNeedsAuth = status?.recentAuth === false || error === "reauth";
  const isDisabled = pending || busy || isAdmin || isNeedsAuth;
  return {
    status,
    setStatus,
    confirmed,
    setConfirmed,
    pending: pending || leaving,
    closed: isClosed,
    error: leaveError ? ("unavailable" as const) : error,
    heldReasons,
    needsAuth: isNeedsAuth,
    disabled: isDisabled,
    signOut,
    leaveClosedAccount,
    submit,
  };
}
type RemovalFormState = ReturnType<typeof useRemovalForm>;

function RemovalForAccount({ sessionId }: { sessionId: string | undefined }) {
  const t = useTranslations("accountRemoval");
  const state = useRemovalForm(sessionId);
  const id = useId();
  return (
    <section className="max-w-2xl space-y-6">
      {!state.pending && !state.closed ? (
        <RemovalStatus onStatus={state.setStatus} />
      ) : null}
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p>{t("intro")}</p>
      </header>
      <p id={`${id}-retained`} className="text-sm text-muted-foreground">
        {t("retained")}
      </p>
      <p className="text-sm text-muted-foreground">{t("checkLimit")}</p>
      {state.closed ? (
        <ClosedRemoval state={state} />
      ) : (
        <OpenRemoval state={state} id={id} />
      )}
    </section>
  );
}
function ClosedRemoval({ state }: { state: RemovalFormState }) {
  const t = useTranslations("accountRemoval");
  const security = useTranslations("accountSecurity");
  return (
    <div className="space-y-4">
      <p role="status">{t("closed")}</p>
      {state.error ? <p role="alert">{t("unavailable")}</p> : null}
      <Button
        disabled={state.pending}
        onClick={() => {
          void state.leaveClosedAccount();
        }}
      >
        {security("signInAgain")}
      </Button>
    </div>
  );
}
function HeldRemoval({ reasons: heldReasons }: { reasons: string[] }) {
  const t = useTranslations("accountRemoval");
  if (heldReasons.length === 0) return null;
  return (
    <div role="status" className="space-y-2 border-s-2 border-border ps-4">
      <p className="font-medium">{t("held")}</p>
      <ul className="list-inside list-disc space-y-2 text-sm">
        {heldReasons.map((code) => (
          <li key={code}>{t(reasonKey(code))}</li>
        ))}
      </ul>
    </div>
  );
}
const errorMessages = {
  ambiguous: "retry",
  reauth: "reauth",
  unavailable: "unavailable",
} as const;
function OpenRemoval({ state, id }: { state: RemovalFormState; id: string }) {
  const t = useTranslations("accountRemoval");
  const common = useTranslations("common");
  const security = useTranslations("accountSecurity");
  return (
    <>
      <HeldRemoval reasons={state.heldReasons} />
      {state.needsAuth ? (
        <div className="space-y-3">
          <p>{t("reauth")}</p>
          <Button
            variant="outline"
            disabled={state.pending}
            onClick={() => {
              void state.signOut();
            }}
          >
            {security("signInAgain")}
          </Button>
        </div>
      ) : null}
      {state.status ? (
        <form
          className="space-y-4 border-t border-border pt-6"
          onSubmit={(event) => {
            event.preventDefault();
            void state.submit();
          }}
        >
          <div className="flex min-h-11 items-start gap-3 py-2">
            <Checkbox
              id={`${id}-confirm`}
              className="mt-1"
              checked={state.confirmed}
              disabled={state.disabled}
              onCheckedChange={(value) => {
                state.setConfirmed(value === true);
              }}
              aria-describedby={`${id}-retained`}
            />
            <Label
              htmlFor={`${id}-confirm`}
              className="min-h-11 leading-relaxed"
            >
              {t("confirm")}
            </Label>
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {t(errorMessages[state.error])}
            </p>
          ) : null}
          <Button
            variant="destructive"
            type="submit"
            disabled={!state.confirmed || state.disabled}
          >
            {state.pending ? common("loading") : t("action")}
          </Button>
        </form>
      ) : (
        <p role="status">{common("loading")}</p>
      )}
    </>
  );
}
