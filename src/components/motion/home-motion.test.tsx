import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeMotion } from "./home-motion";
import { startHomeReveal } from "./home-reveal";

vi.mock("./home-reveal", () => ({ startHomeReveal: vi.fn() }));

describe("optional home motion", () => {
  let isReduced = false;
  let change: (() => void) | undefined;
  const stop = vi.fn();
  const removeMotionListener = vi.fn();

  beforeEach(() => {
    isReduced = false;
    change = undefined;
    vi.clearAllMocks();
    vi.mocked(startHomeReveal).mockReturnValue(stop);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- MediaQueryList fixtures include the required legacy browser methods.
      addListener: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- MediaQueryList fixtures include the required legacy browser methods.
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      get matches() {
        return isReduced;
      },
      addEventListener: (
        _event: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (typeof listener === "function") {
          change = () => {
            listener(new Event("change"));
          };
        }
      },
      removeEventListener: removeMotionListener,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends visible content in the server HTML", () => {
    expect(
      renderToString(
        <HomeMotion>
          <h1>Recover material</h1>
        </HomeMotion>,
      ),
    ).toBe("<div><h1>Recover material</h1></div>");
  });

  it("keeps content visible without starting motion when reduction is requested", async () => {
    isReduced = true;
    render(
      <HomeMotion>
        <h1>Recover material</h1>
      </HomeMotion>,
    );
    await act(() => Promise.resolve());
    expect(screen.getByRole("heading")).toBeVisible();
    expect(startHomeReveal).not.toHaveBeenCalled();
  });

  it("removes active motion immediately when the preference changes", async () => {
    render(
      <HomeMotion>
        <h1>Recover material</h1>
      </HomeMotion>,
    );
    await waitFor(() => {
      expect(startHomeReveal).toHaveBeenCalledOnce();
    });
    act(() => {
      isReduced = true;
      change?.();
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading")).toBeVisible();
  });

  it("releases animations and preference listeners when the page unmounts", async () => {
    const { unmount } = render(
      <HomeMotion>
        <h1>Recover material</h1>
      </HomeMotion>,
    );
    await waitFor(() => {
      expect(startHomeReveal).toHaveBeenCalledOnce();
    });
    unmount();
    expect(stop).toHaveBeenCalledOnce();
    expect(removeMotionListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("does not animate a removed page after the optional module loads", async () => {
    const { unmount } = render(
      <HomeMotion>
        <h1>Recover material</h1>
      </HomeMotion>,
    );
    unmount();
    await act(() => Promise.resolve());
    expect(startHomeReveal).not.toHaveBeenCalled();
  });
});
