import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site/site-header";
import { SkipLink } from "@/components/site/skip-link";

/**
 * Shell for signing in: a centered task with no decorative side panel. Pages
 * here are private — each sets `privateMetadata()` (docs/architecture/urls.md).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-8 sm:px-8 sm:py-12">
        <main id="main" tabIndex={-1} className="flex w-full min-w-0 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
