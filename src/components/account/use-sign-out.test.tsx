import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { useAdminSignOut } from "../admin/use-admin-sign-out";
import { useSignOut } from "./use-sign-out";

const calls = vi.hoisted(() => ({
  revoke: vi.fn(),
  signOut: vi.fn(),
  error: vi.fn(),
  translate: (key: string) => key,
  replace: vi.fn(),
  sessionId: "fixture-session",
}));
vi.mock("@/components/notifications/device-provider", () => ({
  lockDeviceSignOut: () => vi.fn(),
  revokeCurrentDevice: calls.revoke,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { session: { id: calls.sessionId } } }),
    signOut: calls.signOut,
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: calls.replace }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => calls.translate }));
vi.mock("sonner", () => ({ toast: { error: calls.error } }));
beforeEach(() => {
  vi.resetAllMocks();
  calls.sessionId = "fixture-session";
  calls.revoke.mockResolvedValue(undefined);
  calls.signOut.mockResolvedValue({ error: null });
});

it("revokes this installation before clearing the session and navigating", async () => {
  const done = vi.fn();
  const { result } = renderHook(() => useSignOut(done));
  await act(() => result.current.signOut());
  expect(calls.revoke.mock.invocationCallOrder[0]).toBeLessThan(
    calls.signOut.mock.invocationCallOrder[0],
  );
  expect(done).toHaveBeenCalledOnce();
  expect(result.current.busy).toBe(false);
});

it("keeps the session and allows retry when device revocation fails", async () => {
  calls.revoke.mockRejectedValueOnce(new Error("offline"));
  const done = vi.fn();
  const { result } = renderHook(() => useSignOut(done));
  await act(() => result.current.signOut());
  expect(calls.signOut).not.toHaveBeenCalled();
  expect(done).not.toHaveBeenCalled();
  expect(calls.error).toHaveBeenCalledWith("error");
  await act(() => result.current.signOut());
  expect(done).toHaveBeenCalledOnce();
});

it.each(["rejection", "server refusal"])(
  "allows retry after auth %s without navigating",
  async (failure) => {
    if (failure === "rejection") {
      calls.signOut.mockRejectedValueOnce(new Error("offline"));
    } else {
      calls.signOut.mockResolvedValueOnce({ error: { message: "offline" } });
    }
    const done = vi.fn();
    const { result } = renderHook(() => useSignOut(done));
    await act(() => result.current.signOut());
    expect(done).not.toHaveBeenCalled();
    expect(calls.error).toHaveBeenCalledOnce();
    expect(result.current.busy).toBe(false);
    await act(() => result.current.signOut());
    expect(calls.revoke).toHaveBeenCalledTimes(2);
    expect(calls.signOut).toHaveBeenCalledTimes(2);
    expect(done).toHaveBeenCalledOnce();
  },
);

it("coalesces rapid logout taps while revocation is pending", async () => {
  const deferred = Promise.withResolvers<undefined>();
  calls.revoke.mockReturnValueOnce(deferred.promise);
  const { result } = renderHook(() => useSignOut());
  let first: Promise<void>;
  await act(async () => {
    first = result.current.signOut();
    await result.current.signOut();
  });
  expect(calls.revoke).toHaveBeenCalledOnce();
  await act(async () => {
    deferred.resolve(undefined);
    await first;
  });
  expect(calls.signOut).toHaveBeenCalledOnce();
});

it("coalesces rapid logout taps while the auth request is pending", async () => {
  const deferred = Promise.withResolvers<{ error: null }>();
  calls.signOut.mockReturnValueOnce(deferred.promise);
  const done = vi.fn();
  const { result } = renderHook(() => useSignOut(done));
  let first: Promise<void>;
  await act(async () => {
    first = result.current.signOut();
    await result.current.signOut();
  });
  expect(result.current.busy).toBe(true);
  expect(calls.revoke).toHaveBeenCalledOnce();
  expect(calls.signOut).toHaveBeenCalledOnce();
  expect(done).not.toHaveBeenCalled();
  await act(async () => {
    deferred.resolve({ error: null });
    await first;
  });
  expect(done).toHaveBeenCalledOnce();
  expect(result.current.busy).toBe(false);
});

it.each(["during device cleanup", "during auth completion"])(
  "does not continue a removed screen %s",
  async (stage) => {
    const cleanup = Promise.withResolvers<undefined>();
    const logout = Promise.withResolvers<{ error: null }>();
    if (stage === "during device cleanup")
      calls.revoke.mockReturnValueOnce(cleanup.promise);
    else calls.signOut.mockReturnValueOnce(logout.promise);
    const done = vi.fn();
    const { result, unmount } = renderHook(() => useSignOut(done));
    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.signOut();
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      cleanup.resolve(undefined);
      logout.resolve({ error: null });
      await pending;
    });
    if (stage === "during device cleanup")
      expect(calls.signOut).not.toHaveBeenCalled();
    else expect(calls.signOut).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
    expect(calls.error).not.toHaveBeenCalled();
  },
);

for (const [kind, useLogout] of [
  ["member", useSignOut],
  ["admin", useAdminSignOut],
] as const) {
  it(`${kind} does not log out a newer session after device cleanup`, async () => {
    const cleanup = Promise.withResolvers<undefined>();
    calls.revoke.mockReturnValueOnce(cleanup.promise);
    const { result, rerender } = renderHook(() => useLogout());
    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.signOut();
      await Promise.resolve();
    });
    calls.sessionId = "newer-session";
    rerender();
    await act(async () => {
      cleanup.resolve(undefined);
      await pending;
    });
    expect(calls.signOut).not.toHaveBeenCalled();
    expect(calls.replace).not.toHaveBeenCalled();
  });
}
it.each(["during device cleanup", "during auth completion"])(
  "admin does not navigate after unmount %s",
  async (stage) => {
    const cleanup = Promise.withResolvers<undefined>();
    const logout = Promise.withResolvers<{ error: null }>();
    if (stage === "during device cleanup")
      calls.revoke.mockReturnValueOnce(cleanup.promise);
    else calls.signOut.mockReturnValueOnce(logout.promise);
    const { result, unmount } = renderHook(() => useAdminSignOut());
    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.signOut();
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      cleanup.resolve(undefined);
      logout.resolve({ error: null });
      await pending;
    });
    expect(calls.replace).not.toHaveBeenCalled();
    if (stage === "during device cleanup")
      expect(calls.signOut).not.toHaveBeenCalled();
    else expect(calls.signOut).toHaveBeenCalledOnce();
  },
);

for (const [kind, useLogout] of [
  ["member", useSignOut],
  ["admin", useAdminSignOut],
] as const) {
  it(`${kind} does not continue into a newer observed session after auth completion`, async () => {
    const logout = Promise.withResolvers<{ error: null }>();
    calls.signOut.mockReturnValueOnce(logout.promise);
    const done = vi.fn();
    const { result, rerender } = renderHook(() =>
      useLogout(...(kind === "member" ? ([done] as [() => void]) : [])),
    );
    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.signOut();
      await Promise.resolve();
    });
    calls.sessionId = "newer-session";
    rerender();
    await act(async () => {
      logout.resolve({ error: null });
      await pending;
    });
    expect(done).not.toHaveBeenCalled();
    expect(calls.replace).not.toHaveBeenCalled();
  });
}
