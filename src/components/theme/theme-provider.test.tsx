import { runInNewContext } from "node:vm";

import { fireEvent, render, screen } from "@testing-library/react";
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

describe("light-only appearance", () => {
  it("ignores a saved dark preference and removes a stale dark class", () => {
    localStorage.setItem(themeStorageKey, "dark");
    document.documentElement.classList.add("dark");
    renderTheme();
    expect(screen.getByLabelText("Current theme")).toHaveTextContent(
      "light:light",
    );
    expect(document.documentElement).not.toHaveClass("dark");
    expect(
      screen.queryByRole("button", { name: "Appearance" }),
    ).not.toBeInTheDocument();
  });

  it("works when persistent storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    renderTheme();
    expect(document.documentElement).toHaveStyle({ colorScheme: "light" });
  });

  it("does not restore dark mode from another tab", () => {
    renderTheme();
    localStorage.setItem(themeStorageKey, "dark");
    fireEvent(
      window,
      new StorageEvent("storage", { key: themeStorageKey, newValue: "dark" }),
    );
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByLabelText("Current theme")).toHaveTextContent(
      "light:light",
    );
  });

  it("resolves all historical settings to light", () => {
    for (const preference of [null, "system", "dark", "light", "sepia"]) {
      expect(parseTheme(preference)).toBe("light");
    }
  });

  it("forces light before React without storage or device APIs", () => {
    document.documentElement.classList.add("dark");
    // eslint-disable-next-line sonarjs/code-eval -- Runs only the repository-owned static bootstrap in an isolated test context.
    runInNewContext(themeBootstrap, { document });
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement).toHaveStyle({ colorScheme: "light" });
  });
});
