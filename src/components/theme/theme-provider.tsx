"use client";

import { useLocale } from "next-intl";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

import { Toaster } from "@/components/ui/sonner";
import { isLocale, localeDirection } from "@/i18n/locales";

import {
  parseTheme,
  themeMediaQuery,
  type ThemePreference,
  themeStorageKey,
} from "./theme";

const changeEvent = "luma-theme-change";
const memory = { preference: undefined as ThemePreference | undefined };

function readPreference(): ThemePreference {
  if (memory.preference) return memory.preference;
  try {
    return parseTheme(localStorage.getItem(themeStorageKey));
  } catch {
    // Private browsing can deny storage; the current tab still supports themes.
    return "system";
  }
}

function getSnapshot() {
  const preference = readPreference();
  const isDark =
    preference === "dark" ||
    (preference === "system" && matchMedia(themeMediaQuery).matches);
  return `${preference}:${isDark ? "dark" : "light"}` as const;
}

function getServerSnapshot() {
  return "system:light";
}

function subscribe(onChange: () => void) {
  const media = matchMedia(themeMediaQuery);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== themeStorageKey) return;
    memory.preference = undefined;
    onChange();
  };
  media.addEventListener("change", onChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, onChange);
  };
}

function setPreference(preference: ThemePreference) {
  memory.preference = preference;
  try {
    localStorage.setItem(themeStorageKey, preference);
  } catch {
    // Keep this tab's selection when persistent storage is unavailable.
  }
  window.dispatchEvent(new Event(changeEvent));
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolvedTheme: "light",
  setPreference,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [selected, resolved] = snapshot.split(":", 2);
  const preference = parseTheme(selected);
  const resolvedTheme = resolved === "dark" ? "dark" : "light";

  useEffect(() => {
    // Hydration first uses the server snapshot. Do not undo the head bootstrap
    // while React schedules its current browser snapshot.
    if (getSnapshot() !== snapshot) return;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, snapshot]);

  return (
    <ThemeContext value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToaster({
  direction = "ltr",
}: {
  direction?: "ltr" | "rtl";
}) {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      dir={direction}
      position={direction === "rtl" ? "bottom-left" : "bottom-right"}
      richColors
      closeButton
    />
  );
}

/** The admin toaster stays independent of the locale provider. */
export function LocalizedThemeToaster() {
  const locale = useLocale();
  return (
    <ThemeToaster
      direction={isLocale(locale) ? localeDirection(locale) : "ltr"}
    />
  );
}
