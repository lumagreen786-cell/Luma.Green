"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { signOutWithDeviceRevocation } from "@/lib/sign-out";
import { useMounted } from "@/lib/use-mounted";

export function useAdminSignOut() {
  const router = useRouter();
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
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    if (pending.current || !mounted()) return;
    const sessionId = session.data?.session.id;
    const isCurrent = () => mounted() && currentSession.current === sessionId;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await signOutWithDeviceRevocation(sessionId, isCurrent);
      if (!mounted() || lastObservedSession.current !== sessionId) return;
      router.replace("/admin/login");
    } catch {
      if (isCurrent()) setError("Could not sign out. Please try again.");
    } finally {
      pending.current = false;
      if (mounted()) setBusy(false);
    }
  }
  return { signOut, busy, error };
}
