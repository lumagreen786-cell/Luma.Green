import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

/*
 * jsdom implements neither of these, and the shadcn primitives (dialog, sheet,
 * select, tooltip) reach for them on mount. `vi.stubGlobal` keeps the stubs off
 * the real global object and lets Vitest restore them between files.
 */
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
);

// jsdom has no viewport intersections; individual motion tests supply entries.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
);

// input-otp checks whether a password-manager badge covers the code field.
// jsdom has no layout or hit testing.
if (typeof document !== "undefined") {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => null,
  });
  // Radix Select uses these browser APIs during keyboard and pointer choice.
  // jsdom has no layout, scrolling or pointer capture.
  const browserMethods = Object.entries({
    scrollIntoView: vi.fn(),
    hasPointerCapture: (): boolean => false,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  });
  for (const [name, value] of browserMethods) {
    Object.defineProperty(Element.prototype, name, {
      configurable: true,
      value,
    });
  }
}
