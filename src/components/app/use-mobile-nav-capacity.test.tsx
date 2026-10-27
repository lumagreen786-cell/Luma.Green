import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { expect, it, vi } from "vitest";

import { useMobileNavCapacity } from "./use-mobile-nav-capacity";

function Navigation() {
  const ref = useRef<HTMLElement>(null);
  const capacity = useMobileNavCapacity(ref, "kn", true);
  return (
    <nav ref={ref} data-capacity={capacity} aria-label="Daily work">
      {capacity} visible actions
    </nav>
  );
}

it("keeps More reachable after a hidden desktop bar becomes a narrow phone bar", async () => {
  const metrics = { width: 0 };
  let measure: () => void = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: () => void) {
        measure = callback;
      }
    },
  );
  const width = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockImplementation(() => metrics.width);
  const content = vi
    .spyOn(HTMLElement.prototype, "scrollWidth", "get")
    .mockImplementation(function (this: HTMLElement) {
      return Number(this.dataset.capacity) === 4 ? 450 : 300;
    });
  try {
    render(<Navigation />);
    await act(async () => {
      await document.fonts.ready;
    });
    act(() => {
      metrics.width = 320;
      measure();
    });
    expect(
      screen.getByRole("navigation", { name: "Daily work" }),
    ).toHaveTextContent("3 visible actions");
    act(() => {
      metrics.width = 800;
      measure();
    });
    expect(
      screen.getByRole("navigation", { name: "Daily work" }),
    ).toHaveTextContent("4 visible actions");
  } finally {
    width.mockRestore();
    content.mockRestore();
    vi.unstubAllGlobals();
  }
});
