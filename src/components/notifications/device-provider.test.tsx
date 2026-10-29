import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSignOut } from "@/components/account/use-sign-out";
import { useAdminSignOut } from "@/components/admin/use-admin-sign-out";
import { signOutWithDeviceRevocation } from "@/lib/sign-out";

import messages from "../../../messages/en.json";
import {
  NotificationDeviceProvider,
  NotificationRevocationProvider,
  revokeCurrentDevice,
  useNotificationDevice,
} from "./device-provider";
import { NotificationsPage } from "./notifications-page";

interface MockState {
  settings: { webKey: string | null; expo: boolean } | undefined;
  settingsError: boolean;
  me: { hasProfile: boolean };
  session: { data: { session: { id: string } } };
  registerExpo: ReturnType<typeof vi.fn>;
  registerWeb: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  unregisterInstallation: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
}
const mocks = vi.hoisted((): MockState => ({
  settings: { webKey: null, expo: true },
  settingsError: false,
  me: { hasProfile: true },
  session: { data: { session: { id: "session-a" } } },
  registerExpo: vi.fn(),
  registerWeb: vi.fn(),
  unregister: vi.fn(),
  unregisterInstallation: vi.fn(),
  postMessage: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => mocks.session, signOut: mocks.signOut },
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
  useQuery: (query: Parameters<typeof getFunctionName>[0]): unknown => {
    const name = getFunctionName(query);
    if (name === "identity:me") return mocks.me;
    if (name === "push:settings") {
      if (mocks.settingsError) throw new Error("push:settings is unavailable");
      return mocks.settings;
    }
    if (name === "inbox:unreadCount") return 0;
    throw new Error(name);
  },
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(mutation);
    const functions = {
      "push:registerExpo": mocks.registerExpo,
      "push:registerWeb": mocks.registerWeb,
      "push:unregister": mocks.unregister,
      "push:unregisterInstallation": mocks.unregisterInstallation,
    };
    const key = name as keyof typeof functions;
    return functions[key];
  },
}));

function Controls({ label = "Enable" }: { label?: string }) {
  const device = useNotificationDevice();
  return (
    <>
      <p role="status">{device?.status}</p>
      <button
        onClick={() => {
          void device?.enable();
        }}
      >
        {label}
      </button>
    </>
  );
}
function App() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <NotificationDeviceProvider>
        <input aria-label="Unsaved form" />
        <Controls />
      </NotificationDeviceProvider>
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.session = { data: { session: { id: crypto.randomUUID() } } };
  mocks.settings = { webKey: null, expo: true };
  mocks.settingsError = false;
  mocks.me = { hasProfile: true };
  mocks.postMessage.mockReset();
  mocks.registerExpo.mockReset().mockResolvedValue("device-a");
  mocks.registerWeb.mockReset();
  mocks.unregister.mockReset().mockResolvedValue(null);
  mocks.unregisterInstallation.mockReset().mockResolvedValue(null);
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.replace.mockReset();
  vi.stubGlobal("ReactNativeWebView", { postMessage: mocks.postMessage });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function nativeResult(status: string, token?: string) {
  const sent = JSON.parse(
    mocks.postMessage.mock.calls.at(-1)![0] as string,
  ) as { requestId: string };
  document.dispatchEvent(
    new CustomEvent("luma-push-result", {
      detail: {
        requestId: sent.requestId,
        status,
        ...(token && { token }),
      },
    }),
  );
}

describe("authenticated notification lifecycle", () => {
  it("retains failed cleanup across reloads until revocation succeeds", async () => {
    const installation = "11111111-1111-4111-8111-111111111111";
    localStorage.setItem("luma.push.enabled", "true");
    localStorage.setItem("luma.push.installation", installation);
    mocks.settings = undefined;
    mocks.unregisterInstallation.mockRejectedValueOnce(new Error("offline"));
    const view = render(<App />);
    await expect(revokeCurrentDevice()).rejects.toThrow("offline");
    expect(localStorage.getItem("luma.push.enabled")).toBeNull();
    expect(localStorage.getItem("luma.push.revocation-pending")).toBe("true");
    view.unmount();
    await expect(revokeCurrentDevice()).rejects.toThrow("PUSH_NOT_READY");
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("error");
    expect(mocks.postMessage).not.toHaveBeenCalled();
    await act(async () => {
      await revokeCurrentDevice();
    });
    expect(localStorage.getItem("luma.push.revocation-pending")).toBeNull();
    expect(mocks.unregisterInstallation).toHaveBeenLastCalledWith({
      installationId: installation,
    });
  });
  it("preserves application state when the optional notification backend fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      // React reports the deliberately caught query failure to the console.
    });
    const user = userEvent.setup();
    const view = render(<App />);
    const input = screen.getByRole("textbox", { name: "Unsaved form" });
    await user.type(input, "Keep my work");
    mocks.settingsError = true;
    view.rerender(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    expect(screen.getByRole("textbox", { name: "Unsaved form" })).toBe(input);
    expect(input).toHaveValue("Keep my work");
    expect(mocks.postMessage).not.toHaveBeenCalled();
  });
  it("lets the admin revoke a previous locale device before logout without intl", async () => {
    const installation = "11111111-1111-4111-8111-111111111111";
    localStorage.setItem("luma.push.enabled", "true");
    localStorage.setItem("luma.push.installation", installation);
    const user = userEvent.setup();
    render(
      <NotificationRevocationProvider>
        <AdminLogout />
      </NotificationRevocationProvider>,
    );
    expect(mocks.postMessage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mocks.unregisterInstallation).toHaveBeenCalledWith({
      installationId: installation,
    });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(
      mocks.unregisterInstallation.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
  });
  it("does not claim cleanup succeeded when browser storage is blocked", async () => {
    render(<App />);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    await expect(revokeCurrentDevice()).rejects.toThrow("storage blocked");
    expect(mocks.unregisterInstallation).not.toHaveBeenCalled();
  });
  it("never prompts on initial mount and binds only after explicit enable", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(mocks.postMessage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Enable" }));
    expect(mocks.postMessage).toHaveBeenCalledOnce();
    expect(mocks.registerExpo).not.toHaveBeenCalled();
    await act(() => {
      nativeResult("granted", "ExpoPushToken[device]");
      return Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent("granted");
    expect(mocks.registerExpo).toHaveBeenCalledWith({
      token: "ExpoPushToken[device]",
      locale: "en",
      installationId: expect.stringMatching(/^[a-f\d-]{36}$/),
    });
    expect(localStorage.getItem("luma.push.enabled")).toBe("true");
    expect(JSON.stringify(localStorage)).not.toContain("ExpoPushToken");
  });
  it("restores an enabled device with status, never an enable prompt", async () => {
    localStorage.setItem("luma.push.enabled", "true");
    render(<App />);
    await waitFor(() => {
      expect(mocks.postMessage).toHaveBeenCalledOnce();
    });
    expect(mocks.postMessage.mock.calls[0][0]).toContain("luma.push.status");
    await act(() => {
      nativeResult("granted", "ExpoPushToken[restored]");
      return Promise.resolve();
    });
    expect(mocks.registerExpo).toHaveBeenCalledOnce();
  });
  it("keeps form state while session rotation replaces notification work and cleans late bindings", async () => {
    const previousSessionId = mocks.session.data.session.id;
    const firstRegistration = Promise.withResolvers<string>();
    mocks.registerExpo
      .mockReturnValueOnce(firstRegistration.promise)
      .mockResolvedValueOnce("current-device");
    const user = userEvent.setup();
    const view = render(<App />);
    const input = screen.getByRole("textbox", { name: "Unsaved form" });
    await user.type(input, "Keep my work");
    await user.click(screen.getByRole("button", { name: "Enable" }));
    act(() => {
      nativeResult("granted", "ExpoPushToken[before-rotation]");
    });
    await waitFor(() => {
      expect(mocks.registerExpo).toHaveBeenCalledOnce();
    });

    mocks.session = { data: { session: { id: crypto.randomUUID() } } };
    view.rerender(<App />);
    expect(screen.getByRole("textbox", { name: "Unsaved form" })).toBe(input);
    expect(input).toHaveValue("Keep my work");
    await waitFor(() => {
      expect(mocks.postMessage).toHaveBeenCalledTimes(2);
    });
    expect(mocks.postMessage.mock.calls[1][0]).toContain("luma.push.status");
    await act(async () => {
      firstRegistration.resolve("previous-device");
      await firstRegistration.promise;
    });
    expect(mocks.unregister).toHaveBeenCalledExactlyOnceWith({
      id: "previous-device",
      expectedSessionId: previousSessionId,
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("granted");

    await act(async () => {
      nativeResult("granted", "ExpoPushToken[after-rotation]");
      await Promise.resolve();
    });
    expect(mocks.registerExpo).toHaveBeenCalledTimes(2);
    expect(mocks.registerExpo).toHaveBeenLastCalledWith({
      token: "ExpoPushToken[after-rotation]",
      locale: "en",
      installationId: localStorage.getItem("luma.push.installation"),
    });
    expect(screen.getByRole("status")).toHaveTextContent("granted");
    await act(async () => {
      await revokeCurrentDevice();
    });
    expect(mocks.unregister).toHaveBeenLastCalledWith({ id: "current-device" });
    expect(mocks.unregisterInstallation).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("off");
    expect(localStorage.getItem("luma.push.enabled")).toBeNull();
    expect(input).toHaveValue("Keep my work");
  });
  it("scopes late cleanup to the old session when rotation reuses the same device row", async () => {
    const previousSessionId = mocks.session.data.session.id;
    const firstRegistration = Promise.withResolvers<string>();
    mocks.registerExpo
      .mockReturnValueOnce(firstRegistration.promise)
      .mockResolvedValueOnce("shared-device");
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getByRole("button", { name: "Enable" }));
    act(() => {
      nativeResult("granted", "ExpoPushToken[same-token]");
    });
    await waitFor(() => {
      expect(mocks.registerExpo).toHaveBeenCalledOnce();
    });
    mocks.session = { data: { session: { id: crypto.randomUUID() } } };
    view.rerender(<App />);
    await waitFor(() => {
      expect(mocks.postMessage).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      nativeResult("granted", "ExpoPushToken[same-token]");
      await Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent("granted");
    expect(mocks.registerExpo).toHaveBeenCalledTimes(2);
    await act(async () => {
      firstRegistration.resolve("shared-device");
      await firstRegistration.promise;
    });
    expect(mocks.unregister).toHaveBeenCalledExactlyOnceWith({
      id: "shared-device",
      expectedSessionId: previousSessionId,
    });
    expect(screen.getByRole("status")).toHaveTextContent("granted");
    await act(async () => {
      await revokeCurrentDevice();
    });
    expect(mocks.unregister).toHaveBeenLastCalledWith({ id: "shared-device" });
    expect(mocks.unregisterInstallation).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("off");
  });
  it("can revoke before settings or token restoration completes", async () => {
    mocks.settings = undefined;
    const installation = "11111111-1111-4111-8111-111111111111";
    localStorage.setItem("luma.push.enabled", "true");
    localStorage.setItem("luma.push.installation", installation);
    render(<App />);
    await act(async () => {
      await revokeCurrentDevice();
    });
    expect(mocks.unregisterInstallation).toHaveBeenCalledWith({
      installationId: installation,
    });
    expect(mocks.registerExpo).not.toHaveBeenCalled();
  });
  it("removes a late registration before logout completes", async () => {
    const registration = Promise.withResolvers<string>();
    mocks.registerExpo.mockReturnValue(registration.promise);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Enable" }));
    act(() => {
      nativeResult("granted", "ExpoPushToken[late]");
    });
    await waitFor(() => {
      expect(mocks.registerExpo).toHaveBeenCalledOnce();
    });
    let isFinished = false;
    const revoking = (async () => {
      await revokeCurrentDevice();
      isFinished = true;
    })();
    expect(isFinished).toBe(false);
    await act(async () => {
      registration.resolve("late-device");
      await revoking;
    });
    expect(mocks.unregister).toHaveBeenCalledWith({
      id: "late-device",
      expectedSessionId: mocks.session.data.session.id,
    });
    expect(mocks.unregisterInstallation).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("off");
  });
  it("reports denied without binding a token", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Enable" }));
    await act(() => {
      nativeResult("denied");
      return Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent("denied");
    expect(mocks.registerExpo).not.toHaveBeenCalled();
  });
  it("rejects revocation failure so the caller keeps the session", async () => {
    localStorage.setItem(
      "luma.push.installation",
      "11111111-1111-4111-8111-111111111111",
    );
    mocks.unregisterInstallation.mockRejectedValue(new Error("offline"));
    render(<App />);
    await expect(revokeCurrentDevice()).rejects.toThrow("offline");
  });
});

function AdminLogout() {
  const { signOut, error } = useAdminSignOut();
  return (
    <>
      <button
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}

function MemberLogout({ onSignedOut }: { onSignedOut?: () => void }) {
  const { signOut, busy } = useSignOut(onSignedOut);
  return (
    <button
      disabled={busy}
      onClick={() => {
        void signOut();
      }}
    >
      Log out
    </button>
  );
}
function SignOutApp({ onSignedOut }: { onSignedOut?: () => void }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <NotificationDeviceProvider>
        <NotificationsPage />
        <Controls label="Direct enable" />
        <MemberLogout onSignedOut={onSignedOut} />
      </NotificationDeviceProvider>
    </NextIntlClientProvider>
  );
}

it("cannot recreate a binding during sign-out, rerender or a same-session remount", async () => {
  const pendingAuth = Promise.withResolvers<{ error: null }>();
  const finished = vi.fn();
  let hasBinding = true;
  mocks.registerExpo.mockImplementation(() => {
    hasBinding = true;
    return "registered-logout-race";
  });
  mocks.unregisterInstallation.mockImplementation(() => {
    hasBinding = false;
    return null;
  });
  mocks.signOut.mockReturnValue(pendingAuth.promise);
  localStorage.setItem(
    "luma.push.installation",
    "11111111-1111-4111-8111-111111111111",
  );
  const user = userEvent.setup();
  const view = render(<SignOutApp onSignedOut={finished} />);
  const settings = screen.getByRole("button", {
    name: messages.notifications.enable,
  });
  await user.click(screen.getByRole("button", { name: "Log out" }));
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(hasBinding).toBe(false);
  expect(settings).toBeDisabled();
  // A direct caller must be blocked too, even before React disables the UI.
  await user.click(screen.getByRole("button", { name: "Direct enable" }));
  await user.click(settings);
  mocks.settings = { webKey: null, expo: true };
  view.rerender(<SignOutApp onSignedOut={finished} />);
  act(() => {
    document.dispatchEvent(new Event("luma-push-ready"));
    document.dispatchEvent(new Event("luma-push-changed"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(mocks.postMessage).not.toHaveBeenCalled();
  expect(mocks.registerExpo).not.toHaveBeenCalled();
  await act(async () => {
    pendingAuth.resolve({ error: null });
    await pendingAuth.promise;
  });
  expect(finished).toHaveBeenCalledOnce();
  expect(settings).toBeDisabled();
  view.unmount();
  const remount = render(<SignOutApp />);
  expect(
    screen.getByRole("button", { name: messages.common.loading }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Direct enable" }));
  expect(mocks.postMessage).not.toHaveBeenCalled();
  expect(hasBinding).toBe(false);
  // An unrelated new authenticated session is not left locked.
  mocks.session = { data: { session: { id: crypto.randomUUID() } } };
  remount.rerender(<SignOutApp />);
  await user.click(
    screen.getByRole("button", { name: messages.notifications.enable }),
  );
  expect(mocks.postMessage).toHaveBeenCalledOnce();
});

it.each(["revocation", "auth response", "auth rejection"])(
  "unlocks notification controls after %s failure and permits a safe retry",
  async (failure) => {
    localStorage.setItem(
      "luma.push.installation",
      "11111111-1111-4111-8111-111111111111",
    );
    if (failure === "revocation")
      mocks.unregisterInstallation.mockRejectedValueOnce(new Error("offline"));
    else if (failure === "auth response")
      mocks.signOut.mockResolvedValueOnce({ error: { message: "offline" } });
    else mocks.signOut.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<SignOutApp />);
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(
      screen.getByRole("button", { name: messages.notifications.enable }),
    ).toBeEnabled();
    expect(localStorage.getItem("luma.push.revocation-pending")).toBe(
      failure === "revocation" ? "true" : null,
    );
    await user.click(
      screen.getByRole("button", { name: messages.notifications.enable }),
    );
    expect(localStorage.getItem("luma.push.revocation-pending")).toBeNull();
    expect(mocks.postMessage).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(mocks.signOut).toHaveBeenCalledTimes(
      failure === "revocation" ? 1 : 2,
    );
    expect(
      screen.getByRole("button", { name: messages.common.loading }),
    ).toBeDisabled();
  },
);

it("waits for and removes a late binding while the session lock is held", async () => {
  const registration = Promise.withResolvers<string>();
  const pendingAuth = Promise.withResolvers<{ error: null }>();
  mocks.registerExpo.mockReturnValue(registration.promise);
  mocks.signOut.mockReturnValue(pendingAuth.promise);
  const user = userEvent.setup();
  const view = render(<SignOutApp />);
  await user.click(
    screen.getByRole("button", { name: messages.notifications.enable }),
  );
  act(() => {
    nativeResult("granted", "ExpoPushToken[late]");
  });
  await waitFor(() => {
    expect(mocks.registerExpo).toHaveBeenCalledOnce();
  });
  await user.click(screen.getByRole("button", { name: "Log out" }));
  expect(mocks.signOut).not.toHaveBeenCalled();
  mocks.settings = { webKey: null, expo: true };
  view.rerender(<SignOutApp />);
  await act(async () => {
    registration.resolve("late-device");
    await registration.promise;
  });
  expect(mocks.unregister).toHaveBeenCalledWith({
    id: "late-device",
    expectedSessionId: mocks.session.data.session.id,
  });
  expect(mocks.signOut).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Direct enable" }));
  expect(mocks.registerExpo).toHaveBeenCalledOnce();
  await act(async () => {
    pendingAuth.resolve({ error: null });
    await pendingAuth.promise;
  });
});

it("locks synchronously before revocation starts, including a direct enable caller", async () => {
  const cleanup = Promise.withResolvers<null>();
  mocks.unregisterInstallation.mockReturnValue(cleanup.promise);
  localStorage.setItem(
    "luma.push.installation",
    "11111111-1111-4111-8111-111111111111",
  );
  render(<App />);
  let leaving: Promise<void>;
  act(() => {
    leaving = signOutWithDeviceRevocation(mocks.session.data.session.id);
    screen.getByRole("button", { name: "Enable" }).click();
  });
  expect(mocks.postMessage).not.toHaveBeenCalled();
  await act(async () => {
    cleanup.resolve(null);
    await leaving;
  });
});

it("fails closed before cleanup when the authenticated session ID is not ready", async () => {
  render(<App />);
  await expect(signOutWithDeviceRevocation(undefined)).rejects.toThrow(
    "SIGN_OUT_SESSION_NOT_READY",
  );
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(mocks.unregisterInstallation).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Enable" }));
  expect(mocks.postMessage).toHaveBeenCalledOnce();
});

it("a second sign-out caller cannot release the first caller's session lock", async () => {
  const pendingAuth = Promise.withResolvers<{ error: null }>();
  mocks.signOut.mockReturnValue(pendingAuth.promise);
  render(<SignOutApp />);
  let first: Promise<void>;
  await act(async () => {
    first = signOutWithDeviceRevocation(mocks.session.data.session.id);
    await expect(
      signOutWithDeviceRevocation(mocks.session.data.session.id),
    ).rejects.toThrow("SIGN_OUT_PENDING");
  });
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("button", { name: messages.common.loading }),
  ).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Direct enable" }));
  expect(mocks.postMessage).not.toHaveBeenCalled();
  await act(async () => {
    pendingAuth.resolve({ error: null });
    await first;
  });
  expect(
    screen.getByRole("button", { name: messages.common.loading }),
  ).toBeDisabled();
});

it("stops removed-screen logout cleanup after a pending registration settles", async () => {
  const registration = Promise.withResolvers<string>();
  mocks.registerExpo.mockReturnValueOnce(registration.promise);
  const view = render(<SignOutApp />);
  await userEvent.click(screen.getByRole("button", { name: "Direct enable" }));
  await act(async () => {
    await Promise.resolve();
    nativeResult("granted", "ExpoPushToken[fixture-late]");
  });
  await waitFor(() => {
    expect(mocks.registerExpo).toHaveBeenCalledOnce();
  });
  await userEvent.click(screen.getByRole("button", { name: "Log out" }));
  view.unmount();
  await act(async () => {
    registration.resolve("removed-device");
    await registration.promise;
  });
  expect(mocks.unregisterInstallation).not.toHaveBeenCalled();
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it("does not continue to device removal after installation cleanup loses its caller", async () => {
  const cleanup = Promise.withResolvers<null>();
  mocks.unregisterInstallation.mockReturnValueOnce(cleanup.promise);
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Enable" }));
  await act(async () => {
    await Promise.resolve();
    nativeResult("granted", "ExpoPushToken[fixture]");
  });
  await waitFor(() => {
    expect(mocks.registerExpo).toHaveBeenCalledOnce();
  });
  let isCurrent = true;
  const leaving = revokeCurrentDevice(() => isCurrent);
  const rejected = expect(leaving).rejects.toThrow("PUSH_CLEANUP_CANCELLED");
  isCurrent = false;
  await act(async () => {
    cleanup.resolve(null);
    await rejected;
  });
  expect(mocks.unregister).not.toHaveBeenCalled();
  expect(localStorage.getItem("luma.push.revocation-pending")).toBe("true");
});
