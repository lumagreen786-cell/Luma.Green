import type { MetadataRoute } from "next";

import { locales } from "@/i18n/locales";
import { languageAlternates, localizedPath, publicRoutes } from "@/i18n/paths";
import { clientEnv } from "@/lib/env";
import { site } from "@/lib/site";
import {
  businessCanonicalUrl,
  isBusinessMarketingPath,
} from "@/lib/site-domains";

/**
 * Every indexable route, listed once per locale with full hreflang alternates.
 *
 * Routes come from `publicRoutes` in `src/i18n/paths.ts` — the locale fan-out
 * is automatic.
 */
function absoluteUrl(path: string, localizedRoute: string) {
  return clientEnv.NEXT_PUBLIC_BUSINESS_SITE_ENABLED &&
    isBusinessMarketingPath(path)
    ? businessCanonicalUrl(path, localizedRoute)
    : `${site.url}${localizedRoute}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.flatMap((path) =>
    locales.map((locale) => ({
      url: absoluteUrl(path, localizedPath(locale, path)),
      // No reliable content-modified timestamp exists. A build is not an edit.
      changeFrequency: "weekly" as const,
      priority: path === "/" || path === "/business" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          Object.entries(languageAlternates(path)).map(([language, route]) => [
            language,
            absoluteUrl(path, route),
          ]),
        ),
      },
    })),
  );
}
