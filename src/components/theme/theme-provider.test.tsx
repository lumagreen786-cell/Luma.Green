import { runInNewContext } from "node:vm";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTheme, themeBootstrap, themeStorageKey } from "./theme";
import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeToggleControl } from "./theme-toggle";

function CurrentTheme() {
  const { preference, resolvedTheme } = useTheme();
  return (
    <output aria-label="Current theme">
      {preference}:{resolvedTheme}
    </output>
  );
}

function renderTheme() {
  return render(
    <ThemeProvider>
      <ThemeToggleControl
        labels={{
          label: "Appearance",
          light: "Light",
          dark: "Dark",
          system: "System",
        }}
      />
      <CurrentTheme />
    </ThemeProvider>,
  );
}

function clearPreference() {
  localStorage.clear();
  window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey }));
}

beforeEach(() => {
  clearPreference();
  document.documentElement.classList.remove("dark");
});
afterEach(() => {
  vi.restoreAllMocks();
  clearPreference();
});

describe("theme selection", () => {
  it("restores a saved preference on a new screen", () => {
    localStorage.setItem(themeStorageKey, "dark");
    renderTheme();
    expect(screen.getByLabelText("Current theme")).toHaveTextContent(
      "dark:dark",
    );
    expect(document.documentElement).toHaveClass("dark");
  });

  it("lets a keyboard user select a theme and keeps it after remount", async () => {
    const user = userEvent.setup();
    const view = renderTheme();
    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByLabelText("Current theme")).toHaveTextContent(
      "dark:dark",
    );
    expect(localStorage.getItem(themeStorageKey)).toBe("dark");
    view.unmount();
    renderTheme();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("still changes theme when the browser refuses persistence", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const user = userEvent.setup();
    renderTheme();
    await user.click(screen.getByRole("button", { name: "Appearance" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByLabelText("Current theme")).toHaveTextContent(
      "dark:dark",
    );
  });

  it("responds to a preference set in another tab", () => {
    renderTheme();
    localStorage.setItem(themeStorageKey, "dark");
    fireEvent(
      window,
      new StorageEvent("storage", { key: themeStorageKey, newValue: "dark" }),
    );
    expect(document.documentElement).toHaveClass("dark");
  });

  it("follows device changes only in system mode", () => {
    let isDark = false;
    const listeners = new Set<() => void>();
    vi.spyOn(window, "matchMedia").mockImplementation((media) => ({
      media,
      get matches() {
        return isDark;
      },
      onchange: null,
      addEventListener: (
        _event: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.add(listener as () => void);
      },
      removeEventListener: (
        _event: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        listeners.delete(listener as () => void);
      },
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- MediaQueryList fixtures include the required legacy browser methods.
      addListener: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- MediaQueryList fixtures include the required legacy browser methods.
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    renderTheme();
    act(() => {
      isDark = true;
      for (const listener of listeners) listener();
    });
    expect(screen.getByLabelText("Current theme")).toHaveTextContent(
      "system:dark",
    );
    localStorage.setItem(themeStorageKey, "light");
    fireEvent(window, new StorageEvent("storage", { key: themeStorageKey }));
    expect(document.documentElement).not.toHaveClass("dark");
    act(() => {
      for (const listener of listeners) listener();
    });
    expect(screen.getByLabelText("Current theme")).toHaveTextContent(
      "light:light",
    );
  });

  it("uses system mode for missing or unrecognised settings", () => {
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("sepia")).toBe("system");
  });

  it("sets a saved dark theme before React renders", () => {
    localStorage.setItem(themeStorageKey, "dark");
    // Execute the exact static head script to check the first-paint behavior.
    // eslint-disable-next-line sonarjs/code-eval -- Runs only the repository-owned static bootstrap in an isolated test context.
    runInNewContext(themeBootstrap, {
      localStorage,
      document,
      matchMedia: (query: string) => window.matchMedia(query),
    });
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveStyle({ colorScheme: "dark" });
  });
});
