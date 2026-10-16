import "../globals.css";

import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import { themeBootstrap } from "@/components/theme/theme";
import { localeMeta } from "@/i18n/locales";
import { localeFromParams } from "@/i18n/paths";
import { routing } from "@/i18n/routing";
import { clientEnv } from "@/lib/env";
import { fontClassName } from "@/lib/fonts";
import { pageMetadata, searchVerificationMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

interface LocaleParams {
  params: Promise<{ locale: string }>;
}

/** Pre-render every locale at build time. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  const defaults = pageMetadata({
    locale,
    path: "/",
    title: t("title"),
    description: t("description"),
  });
  // A child without its own metadata must never inherit the home canonical.
  // Public pages supply their own canonical and complete language alternates.
  delete defaults.alternates;

  // Defaults for every route. Each page overrides title, description,
  // canonical and Open Graph through `pageMetadata`.
  return {
    ...defaults,
    metadataBase: new URL(site.url),
    title: {
      default: t("title"),
      template: `%s · ${site.name}`,
    },
    applicationName: site.name,
    verification: searchVerificationMetadata({
      google: clientEnv.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      bing: clientEnv.NEXT_PUBLIC_BING_SITE_VERIFICATION,
    }),
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const locale = await localeFromParams(params);

  return (
    <html
      suppressHydrationWarning
      data-astryx-theme="matcha"
      lang={localeMeta[locale].hreflang}
      dir={localeMeta[locale].dir}
      className={`${fontClassName(locale)} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
