import { createContext, type ReactNode, useContext } from "react";

import type en from "../../../messages/en.json";
import { defaultLocale, type Locale } from "../../../src/i18n/locales";
import shellMessages from "./messages.json";

type Scope = "native" | "common" | "brand" | "notifications" | "homeReminder";
type ShellMessages = Pick<typeof en, Scope>;
const catalogues: Record<Locale, ShellMessages> = shellMessages;
const LocaleContext = createContext<Locale>(defaultLocale);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

/** Shell labels are plain catalogue strings. Web pages retain next-intl/ICU. */
export function useTranslations<N extends Scope>(namespace: N) {
  const locale = useContext(LocaleContext);
  return (key: keyof ShellMessages[N]): string => {
    const values = catalogues[locale][namespace];
    return String(values[key]);
  };
}
