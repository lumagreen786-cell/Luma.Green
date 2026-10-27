import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { useViewPreference } from "./use-view-preference";

beforeEach(() => {
  sessionStorage.clear();
});
it("restores a non-sensitive view choice in the same workspace only", () => {
  const first = renderHook(() => useViewPreference("trades.org-a", "buying"));
  act(() => {
    first.result.current[1]("selling");
  });
  expect(first.result.current[0]).toBe("selling");
  first.unmount();
  const returned = renderHook(() =>
    useViewPreference("trades.org-a", "buying"),
  );
  expect(returned.result.current[0]).toBe("selling");
  const other = renderHook(() => useViewPreference("trades.org-b", "buying"));
  expect(other.result.current[0]).toBe("buying");
});
it("keeps the default usable when browser storage is blocked", () => {
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("blocked");
    });
  const view = renderHook(() => useViewPreference("market.org-a", "all"));
  expect(view.result.current[0]).toBe("all");
  act(() => {
    view.result.current[1]("paper");
  });
  expect(view.result.current[0]).toBe("all");
  read.mockRestore();
  write.mockRestore();
});
