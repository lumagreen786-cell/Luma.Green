import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { useListScroll } from "./use-list-scroll";

beforeEach(() => {
  sessionStorage.clear();
});

it("restores the list position only after records load and stops saving after leaving", () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {
    /* No layout in jsdom. */
  });
  let restore: FrameRequestCallback | undefined;
  const frame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      restore = callback;
      return 1;
    });
  sessionStorage.setItem("lg.view.scroll.requests.shop-a", "640");
  const view = renderHook(
    ({ ready }) => {
      useListScroll("requests.shop-a", ready);
    },
    { initialProps: { ready: false } },
  );
  expect(frame).not.toHaveBeenCalled();
  view.rerender({ ready: true });
  act(() => {
    restore?.(0);
  });
  expect(scroll).toHaveBeenCalledWith({ top: 640 });
  const previousScroll = Object.getOwnPropertyDescriptor(window, "scrollY");
  Object.defineProperty(window, "scrollY", { configurable: true, value: 800 });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
  expect(sessionStorage.getItem("lg.view.scroll.requests.shop-a")).toBe("800");
  view.unmount();
  sessionStorage.setItem("lg.view.scroll.requests.shop-a", "900");
  window.dispatchEvent(new Event("scroll"));
  expect(sessionStorage.getItem("lg.view.scroll.requests.shop-a")).toBe("900");
  if (previousScroll) Object.defineProperty(window, "scrollY", previousScroll);
  vi.restoreAllMocks();
});
