import { runInNewContext } from "node:vm";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTheme, themeBootstrap, themeStorageKey } from "./theme";
import { ThemeProvider, useTheme } from "./theme-provider";

function Controls() {
  const { preference, resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <output aria-label="Current theme">
        {preference}:{resolvedTheme}
      </output>
      <button
        onClick={() => {
          setTheme("dark");
        }}
      >
        Dark
      </button>
      <button
        onClick={() => {
          setTheme("light");
        }}
      >
        Light
      </button>
      <button
        onClick={() => {
          setTheme("system");
        }}
      >
        System
      </button>
    </>
  );
}
function renderTheme() {
  return render(
    <ThemeProvider>
      <Controls />
    </ThemeProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Florin appearance", () => {
  it("restores a stored dark preference", () => {
    localStorage.setItem(themeStorageKey, "dark");
    renderTheme();
    expect(screen.getByLabelText("Current theme")).toHaveTextContent(
      "dark:dark",
    );
    expect(document.documentElement).toHaveClass("dark");
  });
  it("persists selection and switches the root appearance", () => {
    renderTheme();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(localStorage.getItem(themeStorageKey)).toBe("dark");
    expect(document.documentElement).toHaveStyle({ colorScheme: "dark" });
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
  it("allows a session choice when storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    renderTheme();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
  });
  it("receives changes from another tab", async () => {
    renderTheme();
    localStorage.setItem(themeStorageKey, "dark");
    await act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: themeStorageKey, newValue: "dark" }),
      ),
    );
    expect(document.documentElement).toHaveClass("dark");
  });
  it("uses the system for absent or invalid settings", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    for (const value of [null, "system", "sepia"])
      expect(parseTheme(value)).toBe("system");
  });
  it("restores dark before React and survives denied storage", () => {
    // eslint-disable-next-line sonarjs/code-eval -- Repository-owned first-paint bootstrap in an isolated context.
    runInNewContext(themeBootstrap, {
      document,
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
      },
      window: { matchMedia: () => ({ matches: true }) },
    });
    expect(document.documentElement).toHaveClass("dark");
  });
});
