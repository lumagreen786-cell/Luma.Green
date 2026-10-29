"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { isDesktopShell, isNativePushAvailable } from "@/lib/push-device";
import { preparePushDevice } from "@/lib/push-prepare";
import { useMounted } from "@/lib/use-mounted";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { NotificationErrorBoundary } from "./notification-error-boundary";

type Status = "off" | "busy" | "granted" | "denied" | "unavailable" | "error";
interface DeviceContext {
  status: Status;
  signingOut: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}
const Device = createContext<DeviceContext | null>(null);
const lifecycle: { revoke?: (isCurrent?: () => boolean) => Promise<void> } = {};
// Keep successful sign-out locks beyond provider effect cleanup/remount. A new
// authenticated session has a new ID and therefore a separate lifecycle.
const signOutLocks = new Map<string, symbol>();
const signOutListeners = new Set<() => void>();
function subscribeToSignOut(listener: () => void) {
  signOutListeners.add(listener);
  return () => {
    signOutListeners.delete(listener);
  };
}
function notifySignOut() {
  for (const listener of signOutListeners) listener();
}

/** Lock synchronously; only a failed sign-out may release this session. */
export function lockDeviceSignOut(sessionId: string | undefined): () => void {
  if (!sessionId) throw new Error("SIGN_OUT_SESSION_NOT_READY");
  if (signOutLocks.has(sessionId)) throw new Error("SIGN_OUT_PENDING");
  const lock = Symbol(sessionId);
  signOutLocks.set(sessionId, lock);
  notifySignOut();
  return () => {
    if (signOutLocks.get(sessionId) !== lock) return;
    signOutLocks.delete(sessionId);
    notifySignOut();
  };
}

const consentKey = "luma.push.enabled";
const pendingRevocationKey = "luma.push.revocation-pending";
const installationKey = "luma.push.installation";

function installationId() {
  let id = localStorage.getItem(installationKey);
  if (!id || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(installationKey, id);
  }
  return id;
}

/** Call before clearing the auth session. Failures reject so the caller can retry. */
export async function revokeCurrentDevice(
  isCurrent: () => boolean = () => true,
): Promise<void> {
  if (!isCurrent()) throw new Error("PUSH_CLEANUP_CANCELLED");
  if (
    !lifecycle.revoke &&
    (localStorage.getItem(consentKey) === "true" ||
      localStorage.getItem(pendingRevocationKey) === "true")
  )
    throw new Error("PUSH_NOT_READY");
  await lifecycle.revoke?.(isCurrent);
}

export function useNotificationDevice() {
  return useContext(Device);
}

export function NotificationDeviceProvider({
  children,
}: {
  children: ReactNode;
}) {
  return isConvexConfigured ? (
    <ConnectedProvider>{children}</ConnectedProvider>
  ) : (
    children
  );
}

/** Admin has no locale provider. It still uses exactly the same device cleanup. */
export function NotificationRevocationProvider({
  children,
}: {
  children: ReactNode;
}) {
  return isConvexConfigured ? (
    <ConnectedProvider revokeOnly>{children}</ConnectedProvider>
  ) : (
    children
  );
}

interface PublishedDevice {
  sessionId: string;
  value: DeviceContext;
}

function ConnectedProvider({
  children,
  revokeOnly = false,
}: {
  children: ReactNode;
  revokeOnly?: boolean;
}) {
  const { isAuthenticated } = useConvexAuth();
  const session = authClient.useSession();
  const me = useQuery(api.identity.me, isAuthenticated ? {} : "skip");
  const sessionId =
    isAuthenticated && me?.hasProfile ? session.data?.session.id : undefined;
  const [device, setDevice] = useState<PublishedDevice | null>(null);
  const publish = useCallback((id: string, value: DeviceContext | null) => {
    setDevice((current) => {
      if (value) return { sessionId: id, value };
      return current?.sessionId === id ? null : current;
    });
  }, []);
  return (
    <Device
      value={device && device.sessionId === sessionId ? device.value : null}
    >
      {children}
      {/* Only device work restarts. TOTP rotation must not erase enrollment state. */}
      {sessionId && revokeOnly ? (
        <RevocationOnly key={sessionId} sessionId={sessionId} />
      ) : null}
      {sessionId && !revokeOnly ? (
        <ActiveSession
          key={sessionId}
          sessionId={sessionId}
          publish={publish}
        />
      ) : null}
    </Device>
  );
}

function RevocationOnly({ sessionId }: { sessionId: string }) {
  useDeviceLifecycle(sessionId);
  return null;
}

interface PushSettings {
  webKey: string | null;
  expo: boolean;
}
const ignoreStatus: (status: Status) => void = () => {
  // The admin cleanup lifecycle has no notification settings display.
};

function ActiveSession({
  sessionId,
  publish,
}: {
  sessionId: string;
  publish: (sessionId: string, value: DeviceContext | null) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("notifications");
  const [settings, setSettings] = useState<PushSettings>();
  const [status, setStatus] = useState<Status>("off");
  const isSigningOut = useSyncExternalStore(
    subscribeToSignOut,
    () => signOutLocks.has(sessionId),
    () => false,
  );
  const { enable, disable } = useDeviceLifecycle(sessionId, {
    locale,
    settings,
    setStatus,
  });
  const unavailable = useCallback(() => {
    setStatus("unavailable");
    setSettings(undefined);
  }, []);
  useEffect(() => {
    publish(sessionId, { status, signingOut: isSigningOut, enable, disable });
    return () => {
      publish(sessionId, null);
    };
  }, [publish, sessionId, status, isSigningOut, enable, disable]);
  return (
    <NotificationErrorBoundary onError={unavailable}>
      <SettingsLoader onSettings={setSettings} />
      {!isSigningOut && status === "granted" && isDesktopShell() ? (
        <DesktopUpdates
          title={t("lockscreenTitle")}
          body={t("lockscreenBody")}
        />
      ) : null}
    </NotificationErrorBoundary>
  );
}

function SettingsLoader({
  onSettings,
}: {
  onSettings: (value: PushSettings | undefined) => void;
}) {
  const settings = useQuery(api.push.settings, {});
  useEffect(() => {
    onSettings(settings);
  }, [onSettings, settings]);
  return null;
}

function useDeviceLifecycle(
  sessionId: string,
  options?: {
    locale: string;
    settings: PushSettings | undefined;
    setStatus: (status: Status) => void;
  },
) {
  const locale = options?.locale ?? "en";
  const settings = options?.settings;
  const setStatus = options?.setStatus ?? ignoreStatus;
  const shouldRestore = options !== undefined;
  const mounted = useMounted();
  const registerWeb = useMutation(api.push.registerWeb);
  const registerExpo = useMutation(api.push.registerExpo);
  const unregister = useMutation(api.push.unregister);
  const unregisterInstallation = useMutation(api.push.unregisterInstallation);
  const work = useRef<{
    id?: Id<"pushDevices">;
    pending?: Promise<void>;
    abort?: AbortController;
    generation: number;
    stopped: boolean;
  }>({ generation: 0, stopped: false });

  const connect = useCallback(
    (shouldAsk: boolean): Promise<void> => {
      if (signOutLocks.has(sessionId)) return Promise.resolve();
      if (work.current.pending) return work.current.pending;
      if (!settings || work.current.stopped) return Promise.resolve();
      const generation = ++work.current.generation;
      const abort = new AbortController();
      work.current.abort = abort;
      const isCurrent = () =>
        !abort.signal.aborted &&
        generation === work.current.generation &&
        !work.current.stopped &&
        !signOutLocks.has(sessionId);
      const bind = async (id: Id<"pushDevices">) => {
        work.current.id = id;
        if (!isCurrent()) {
          await unregister({ id, expectedSessionId: sessionId });
          if (work.current.id === id) work.current.id = undefined;
          return;
        }
        setStatus("granted");
      };
      const task = async () => {
        if (shouldAsk) {
          localStorage.setItem(consentKey, "true");
          setStatus("busy");
        }
        const result = await preparePushDevice(
          settings,
          shouldAsk,
          abort.signal,
        );
        if (!isCurrent()) return;
        if (result.status !== "granted") {
          if (result.status === "denied") {
            const installation = localStorage.getItem(installationKey);
            if (installation)
              await unregisterInstallation({ installationId: installation });
            work.current.id = undefined;
          }
          setStatus(result.status);
          return;
        }
        if (result.kind === "native") {
          await bind(
            await registerExpo({
              token: result.token,
              locale,
              installationId: installationId(),
            }),
          );
        } else if (result.kind === "web") {
          await bind(
            await registerWeb({
              subscription: result.subscription,
              locale,
              installationId: installationId(),
            }),
          );
        } else setStatus("granted");
      };
      const pending = (async () => {
        try {
          await task();
        } catch {
          if (isCurrent()) setStatus("error");
        } finally {
          work.current.pending = undefined;
        }
      })();
      work.current.pending = pending;
      return pending;
    },
    [
      locale,
      sessionId,
      registerExpo,
      registerWeb,
      settings,
      unregister,
      unregisterInstallation,
      setStatus,
    ],
  );

  useEffect(() => {
    if (!shouldRestore) return;
    const currentWork = work.current;
    currentWork.stopped = false;
    const restore = () => {
      if (signOutLocks.has(sessionId)) return;
      try {
        if (localStorage.getItem(pendingRevocationKey) === "true") {
          setStatus("error");
          return;
        }
        if (localStorage.getItem(consentKey) === "true") void connect(false);
      } catch {
        setStatus("error");
      }
    };
    restore();
    document.addEventListener("luma-push-ready", restore);
    document.addEventListener("luma-push-changed", restore);
    window.addEventListener("focus", restore);
    return () => {
      document.removeEventListener("luma-push-ready", restore);
      document.removeEventListener("luma-push-changed", restore);
      window.removeEventListener("focus", restore);
      currentWork.stopped = true;
      currentWork.generation += 1;
      currentWork.abort?.abort();
    };
  }, [connect, setStatus, shouldRestore, sessionId]);

  const disable = useCallback(
    async (isRequestedCurrent: () => boolean = () => true) => {
      const assertCurrent = () => {
        if (!mounted() || !isRequestedCurrent())
          throw new Error("PUSH_CLEANUP_CANCELLED");
      };
      assertCurrent();
      // Persist only consent, never a token. Do this before revocation so a refresh
      // cannot silently recreate a device binding after the user turns it off.
      localStorage.setItem(pendingRevocationKey, "true");
      localStorage.removeItem(consentKey);
      work.current.generation += 1;
      work.current.abort?.abort();
      await work.current.pending;
      assertCurrent();
      const installation = localStorage.getItem(installationKey);
      if (installation)
        await unregisterInstallation({ installationId: installation });
      assertCurrent();
      if (work.current.id) {
        await unregister({ id: work.current.id });
        assertCurrent();
        work.current.id = undefined;
      }
      if (
        !isNativePushAvailable() &&
        !isDesktopShell() &&
        "serviceWorker" in navigator
      ) {
        const registration =
          await navigator.serviceWorker.getRegistration("/push-sw.js");
        assertCurrent();
        const subscription = await registration?.pushManager.getSubscription();
        assertCurrent();
        if (subscription) await subscription.unsubscribe();
        assertCurrent();
      }
      localStorage.removeItem(pendingRevocationKey);
      setStatus("off");
    },
    [mounted, setStatus, unregister, unregisterInstallation],
  );

  useEffect(() => {
    lifecycle.revoke = disable;
    return () => {
      if (lifecycle.revoke === disable) delete lifecycle.revoke;
    };
  }, [disable]);

  const enable = useCallback(async () => {
    if (signOutLocks.has(sessionId)) return;
    if (localStorage.getItem(pendingRevocationKey) === "true") await disable();
    await connect(true);
  }, [connect, disable, sessionId]);
  return { enable, disable };
}

/** Electron notifications work while this process runs; never register Web Push. */
function DesktopUpdates({ title, body }: { title: string; body: string }) {
  const router = useRouter();
  const result = useQuery(api.inbox.list, {
    paginationOpts: { numItems: 1, cursor: null },
  });
  const latest = result?.page.at(0);
  const seen = useRef<string | undefined>(undefined);
  const initialized = useRef(false);
  useEffect(() => {
    if (!result) return;
    const previous = seen.current;
    seen.current = latest?.id;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (
      !latest ||
      previous === latest.id ||
      latest.read ||
      Notification.permission !== "granted"
    )
      return;
    const notification = new Notification(title, {
      body,
      icon: "/logo.svg",
      tag: "luma-update",
    });
    notification.addEventListener("click", () => {
      window.focus();
      router.push("/account/notifications");
      notification.close();
    });
    return () => {
      notification.close();
    };
  }, [body, latest, result, router, title]);
  return null;
}
