import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { RotatingAudience } from "./rotating-audience";

const preference = { isReduced: false };
vi.mock("./motion-preference", () => ({
  useIsReducedMotion: () => preference.isReduced,
}));
const observerState: { enter?: () => void } = {};

function renderAudience() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RotatingAudience />
    </NextIntlClientProvider>,
  );
}
function advance() {
  act(() => {
    vi.advanceTimersByTime(3200);
  });
}

describe("Afterlife audience text", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preference.isReduced = false;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = (target: Element) => {
          observerState.enter = () => {
            const rect = target.getBoundingClientRect();
            this.callback(
              [
                {
                  target,
                  isIntersecting: true,
                  intersectionRatio: 1,
                  boundingClientRect: rect,
                  intersectionRect: rect,
                  rootBounds: rect,
                  time: 0,
                },
              ],
              new IntersectionObserver(vi.fn()),
            );
          };
        };
        unobserve = vi.fn();
        disconnect = vi.fn();
        constructor(private callback: IntersectionObserverCallback) {}
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("cycles the three audience labels only when in view", () => {
    renderAudience();
    advance();
    expect(screen.getByText("Apartments")).toBeInTheDocument();
    act(() => observerState.enter?.());
    advance();
    expect(screen.getByText("Coffee shops")).toBeInTheDocument();
    advance();
    expect(screen.getByText("Offices")).toBeInTheDocument();
    advance();
    expect(screen.getByText("Apartments")).toBeInTheDocument();
  });
  it("keeps the initial audience still for reduced motion", () => {
    preference.isReduced = true;
    renderAudience();
    act(() => observerState.enter?.());
    advance();
    expect(screen.getByText("Apartments")).toBeInTheDocument();
    expect(screen.queryByText("Coffee shops")).not.toBeInTheDocument();
  });
});
