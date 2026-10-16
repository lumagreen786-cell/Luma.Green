"use client";

import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useSignOut } from "@/components/account/use-sign-out";
import { AppPageHeader } from "@/components/app/page-parts";
import { useVerifiedSession } from "@/components/providers/use-signed-in-query";
import { ErrorBoundary } from "@/components/sell/states";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { reloadCurrentPage } from "@/lib/reload-current-page";

import { api } from "../../../convex/_generated/api";

export function InvitationPage({ token: initialToken }: { token: string }) {
  // Keep the token above the local recovery boundary, never in browser storage.
  const [token] = useState(initialToken);
  const common = useTranslations("common");
  useEffect(() => {
    // Auth changes can remount this screen while login navigation is pending.
    // Strip only an actual invitation query; never overwrite that later navigation.
    const current = new URL(window.location.href);
    if (
      token &&
      current.pathname.endsWith("/account/workspaces/invite") &&
      current.searchParams.has("token")
    )
      window.history.replaceState(null, "", current.pathname);
  }, [token]);
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-6">
          <p role="alert">{common("error")}</p>
          <Button
            onClick={() => {
              const target = new URL(window.location.href);
              target.search = "";
              target.searchParams.set("token", token);
              window.history.replaceState(
                null,
                "",
                `${target.pathname}${target.search}`,
              );
              reloadCurrentPage();
            }}
          >
            {common("retry")}
          </Button>
        </div>
      )}
    >
      <InvitationContent token={token} />
    </ErrorBoundary>
  );
}

function InvitationContent({ token }: { token: string }) {
  const t = useTranslations("workspace");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { isReady, isPending } = useVerifiedSession();
  const accept = useMutation(api.workspace.acceptInvitation);
  const ensureProfile = useMutation(api.identity.ensureProfile);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const { signOut, busy: signingOut } = useSignOut(() => {
    router.replace({
      pathname: "/login",
      query: {
        next: `/account/workspaces/invite?token=${encodeURIComponent(token)}`,
      },
    });
  });
  const invitation = useQuery(
    api.workspace.invitation,
    isReady && !signingOut ? { token } : "skip",
  );
  async function join() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await ensureProfile({ locale });
      await accept({ token });
      router.replace("/account/workspaces");
    } catch {
      toast.error(t("unavailable"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-xl min-w-0 flex-col gap-6">
      <AppPageHeader title={t("inviteTitle")} />
      {isPending || (isReady && invitation === undefined) ? (
        <p>{common("loading")}</p>
      ) : null}
      {!isPending && !isReady ? <p role="alert">{t("unavailable")}</p> : null}
      {invitation?.status === "ready" ? (
        <>
          <p>
            {t("join", { name: invitation.orgName, role: t(invitation.role) })}
          </p>
          <Button
            disabled={busy}
            onClick={() => void join()}
            className="self-start"
          >
            {t("accept")}
          </Button>
        </>
      ) : null}
      {invitation && invitation.status !== "ready" ? (
        <>
          <p role="alert">
            {t(
              invitation.status === "verifyEmail"
                ? "verifyEmail"
                : "unavailable",
            )}
          </p>
          <p>{t("switchHint")}</p>
          <Button
            disabled={signingOut}
            onClick={() => void signOut()}
            className="self-start"
          >
            {t("switchAccount")}
          </Button>
        </>
      ) : null}
    </div>
  );
}
