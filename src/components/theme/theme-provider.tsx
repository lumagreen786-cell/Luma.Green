"use client";

import { Theme as AstryxTheme } from "@astryxdesign/core/theme";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import { useLocale } from "next-intl";
import { type ReactNode, useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { isLocale, localeDirection } from "@/i18n/locales";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  }, []);

  return (
    <AstryxTheme theme={matchaTheme} mode="light">
      {children}
    </AstryxTheme>
  );
}

export function useTheme() {
  return { preference: "light", resolvedTheme: "light" } as const;
}

export function ThemeToaster({
  direction = "ltr",
}: {
  direction?: "ltr" | "rtl";
}) {
  return (
    <Toaster
      theme="light"
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
