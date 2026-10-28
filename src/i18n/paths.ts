import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";

import { defaultLocale, type Locale, localeMeta, locales } from "./locales";
import { routing } from "./routing";

/**
 * Every public, indexable route. The sitemap fans these out across all
 * locales, so adding a marketing page means adding its path here.
 */
export const publicRoutes = [
  "/",
  "/how-it-works",
  "/participants",
  "/contact",
  "/privacy",
  "/join",
  "/sell",
  "/prices",
  "/standards",
  "/solar",
  "/help",
] as const;

export type PublicRoute = (typeof publicRoutes)[number];

/**
 * The path a route is served at in a locale. English has no prefix
 * (`localePrefix: "as-needed"`), every other locale does.
 */
export function localizedPath(locale: Locale, path: string): string {
  if (locale === defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** hreflang → path for every locale, plus `x-default` pointing at English. */
export function languageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(
      locales.map((l) => [localeMeta[l].hreflang, localizedPath(l, path)]),
    ),
    "x-default": path,
  };
}

/** Resolves the `[locale]` param, 404ing on anything we don't ship. */
export async function localeFromParams(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}
