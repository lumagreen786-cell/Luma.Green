import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { BookingPhone, CONVERSATION_COUNT } from "./booking-phone";

const preference = { isReduced: false };
const callbacks: IntersectionObserverCallback[] = [];
vi.mock("./motion-preference", () => ({
  useIsReducedMotion: () => preference.isReduced,
}));

function renderPhone() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BookingPhone />
    </NextIntlClientProvider>,
  );
}
function visibility(isVisible: boolean) {
  act(() => {
    const target = screen.getByText(
      messages.afterlifePhone.description,
    ).parentElement;
    if (!target) throw new Error("Phone container missing");
    const rect = target.getBoundingClientRect();
    callbacks[0](
      [
        {
          target,
          isIntersecting: isVisible,
          intersectionRatio: isVisible ? 1 : 0,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: rect,
          time: 0,
        },
      ],
      new IntersectionObserver(vi.fn()),
    );
  });
}
function advance(time = 1900) {
  act(() => {
    vi.advanceTimersByTime(time);
  });
}

describe("Afterlife booking illustration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preference.isReduced = false;
    callbacks.length = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        constructor(callback: IntersectionObserverCallback) {
          callbacks.push(callback);
        }
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits until visible and pauses offscreen", () => {
    renderPhone();
    advance(10_000);
    expect(
      screen.queryByText(messages.afterlifePhone.greeting),
    ).not.toBeInTheDocument();
    visibility(true);
    advance();
    expect(
      screen.getByText(messages.afterlifePhone.greeting),
    ).toBeInTheDocument();
    visibility(false);
    advance(10_000);
    expect(
      screen.queryByText(messages.afterlifePhone.scenario0.caption),
    ).not.toBeInTheDocument();
  });

  it("cycles all fifteen scenarios and resets without showing playback controls", () => {
    renderPhone();
    visibility(true);
    for (let scenario = 0; scenario < CONVERSATION_COUNT; scenario++) {
      for (let message = 1; message < 8; message++) advance();
      expect(
        screen.getByText(messages.afterlifePhone.thanks),
      ).toBeInTheDocument();
      advance(4500);
    }
    expect(
      screen.getByText(messages.afterlifePhone.scenario0.hello),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.afterlifePhone.thanks),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a static complete conversation for reduced motion", () => {
    preference.isReduced = true;
    renderPhone();
    expect(
      screen.getByText(messages.afterlifePhone.thanks),
    ).toBeInTheDocument();
    visibility(true);
    advance(60_000);
    expect(
      screen.getByText(messages.afterlifePhone.scenario0.hello),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.afterlifePhone.scenario1.hello),
    ).not.toBeInTheDocument();
  });
});
