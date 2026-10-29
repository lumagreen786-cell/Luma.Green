"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { signOutWithDeviceRevocation } from "@/lib/sign-out";
import { useMounted } from "@/lib/use-mounted";

/** Keep the session available to retry when device revocation fails. */
export function useSignOut(onSignedOut?: () => void) {
  const t = useTranslations("common");
  const session = authClient.useSession();
  const mounted = useMounted();
  const currentSession = useRef(session.data?.session.id);
  const lastObservedSession = useRef(session.data?.session.id);
  useEffect(() => {
    currentSession.current = session.data?.session.id;
    if (session.data?.session.id)
      lastObservedSession.current = session.data.session.id;
  }, [session.data?.session.id]);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (pending.current || !mounted()) return;
    const sessionId = session.data?.session.id;
    const isCurrent = () => mounted() && currentSession.current === sessionId;
    pending.current = true;
    setBusy(true);
    try {
      await signOutWithDeviceRevocation(sessionId, isCurrent);
      if (!mounted() || lastObservedSession.current !== sessionId) return;
      onSignedOut?.();
    } catch {
      if (isCurrent()) toast.error(t("error"));
    } finally {
      pending.current = false;
      if (mounted()) setBusy(false);
    }
  }
  return { signOut, busy };
}
