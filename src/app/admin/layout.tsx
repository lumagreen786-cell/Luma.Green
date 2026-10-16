import "../globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AdminProviders } from "@/components/admin/admin-providers";
import { themeBootstrap } from "@/components/theme/theme";
import { fontClassName } from "@/lib/fonts";
import { site } from "@/lib/site";

/**
 * Root layout for `/admin` — English only, outside the locale segment
 * (docs/architecture/urls.md). Never indexed: next.config.ts also sends
 * `X-Robots-Tag: noindex` for every `/admin` response.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · ${site.name} admin` },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      suppressHydrationWarning
      data-astryx-theme="matcha"
      lang="en"
      dir="ltr"
      className={`${fontClassName("en")} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-3 focus:text-foreground focus:ring-3 focus:ring-ring focus:outline-none"
        >
          Skip to main content
        </a>
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
