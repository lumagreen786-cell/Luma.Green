import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useShellUpdates } from "../src/use-updates";

const updates = vi.hoisted(() => ({
  pending: false,
  check: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("expo-updates", () => ({
  isEnabled: true,
  useUpdates: () => ({ isUpdatePending: updates.pending }),
  checkForUpdateAsync: updates.check,
  fetchUpdateAsync: updates.fetch,
  reloadAsync: updates.reload,
}));
beforeEach(() => {
  vi.clearAllMocks();
  updates.pending = false;
  updates.check.mockResolvedValue({ isAvailable: true });
  updates.fetch.mockResolvedValue({ isNew: true });
});
afterEach(cleanup);

it("downloads without restarting and rejects unsafe restarts", async () => {
  const { result } = renderHook(useShellUpdates);
  await act(() => result.current.check());
  expect(result.current.state).toBe("ready");
  expect(updates.reload).not.toHaveBeenCalled();
  await act(() => result.current.restart(false));
  expect(updates.reload).not.toHaveBeenCalled();
  await act(() => result.current.restart(true));
  expect(updates.reload).toHaveBeenCalledOnce();
});

it("keeps a failed download or restart recoverable", async () => {
  updates.fetch.mockRejectedValueOnce(new Error("offline"));
  const { result } = renderHook(useShellUpdates);
  await act(() => result.current.check());
  expect(result.current.state).toBe("failed");
  await act(() => result.current.check());
  updates.reload.mockRejectedValueOnce(new Error("reload failed"));
  await act(() => result.current.restart(true));
  expect(result.current.state).toBe("failed");
});

it("stages an embedded rollback without restarting the active session", async () => {
  updates.check.mockResolvedValueOnce({
    isAvailable: false,
    isRollBackToEmbedded: true,
  });
  updates.fetch.mockResolvedValueOnce({
    isNew: false,
    isRollBackToEmbedded: true,
  });
  const { result } = renderHook(useShellUpdates);
  await act(() => result.current.check());
  expect(updates.fetch).toHaveBeenCalledOnce();
  expect(result.current.state).toBe("ready");
  expect(updates.reload).not.toHaveBeenCalled();
  await act(() => result.current.restart(false));
  expect(updates.reload).not.toHaveBeenCalled();
  await act(() => result.current.restart(true));
  expect(updates.reload).toHaveBeenCalledOnce();
});

it("uses the fetched rollback result if the server changes after the check", async () => {
  updates.fetch.mockResolvedValueOnce({
    isNew: false,
    isRollBackToEmbedded: true,
  });
  const { result } = renderHook(useShellUpdates);
  await act(() => result.current.check());
  expect(result.current.state).toBe("ready");
  expect(updates.reload).not.toHaveBeenCalled();
});

it("does not fetch when no update or rollback is available", async () => {
  updates.check.mockResolvedValueOnce({
    isAvailable: false,
    isRollBackToEmbedded: false,
  });
  const { result } = renderHook(useShellUpdates);
  await act(() => result.current.check());
  expect(result.current.state).toBe("current");
  expect(updates.fetch).not.toHaveBeenCalled();
  expect(updates.reload).not.toHaveBeenCalled();
});
