"use client";

import { Theme as AstryxTheme } from "@astryxdesign/core/theme";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import { useLocale } from "next-intl";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { Toaster } from "@/components/ui/sonner";
import { isLocale, localeDirection } from "@/i18n/locales";

import { parseTheme, type ThemePreference, themeStorageKey } from "./theme";

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (value: ThemePreference) => void;
}
const ThemeContext = createContext<ThemeState>({
  preference: "system",
  resolvedTheme: "light",
  setTheme: () => {
    /* Controls outside a provider keep the default appearance. */
  },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const readStorage = () => {
      try {
        setPreference(parseTheme(localStorage.getItem(themeStorageKey)));
      } catch {
        setPreference("system");
      }
    };
    const onMedia = () => {
      setSystemDark(media.matches);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey || event.key === null) readStorage();
    };
    readStorage();
    onMedia();
    media.addEventListener("change", onMedia);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const systemTheme = systemDark ? "dark" : "light";
  const resolvedTheme = preference === "system" ? systemTheme : preference;
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);
  const setTheme = (value: ThemePreference) => {
    setPreference(value);
    try {
      localStorage.setItem(themeStorageKey, value);
    } catch {
      /* The session preference still works without storage. */
    }
  };
  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setTheme }}>
      <AstryxTheme theme={matchaTheme} mode={resolvedTheme}>
        {children}
      </AstryxTheme>
    </ThemeContext.Provider>
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
