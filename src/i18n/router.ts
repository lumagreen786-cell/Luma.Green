"use client";

import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useRouter as useNextRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useMemo } from "react";

import { getPathname, type LocaleRouter } from "./navigation-shared";

/**
 * The route owns the locale, so navigate directly to its canonical URL.
 * next-intl's router forces a locale prefix and expects a server redirect to
 * remove `/en`; production's client cache can skip that redirect entirely.
 */
export function useRouter(): LocaleRouter {
  const router = useNextRouter();
  const locale = useLocale();
  return useMemo(
    () => ({
      ...router,
      push(href, options) {
        const { locale: next = locale, ...rest } = options ?? {};
        const target = getPathname({ href, locale: next });
        if (Object.keys(rest).length > 0) router.push(target, rest);
        else router.push(target);
      },
      replace(href, options) {
        const { locale: next = locale, ...rest } = options ?? {};
        const target = getPathname({ href, locale: next });
        if (Object.keys(rest).length > 0) router.replace(target, rest);
        else router.replace(target);
      },
      prefetch(href, options) {
        const { locale: next = locale, ...rest } = options ?? {};
        const target = getPathname({ href, locale: next });
        if (Object.keys(rest).length > 0)
          router.prefetch(target, {
            ...rest,
            kind: rest.kind ?? PrefetchKind.AUTO,
          });
        else router.prefetch(target);
      },
    }),
    [locale, router],
  );
}
