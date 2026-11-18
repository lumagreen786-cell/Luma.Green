import type { ReactNode } from "react";

import { FocusedPageCanvas } from "@/components/site/focused-page-canvas";
import { SiteHeader } from "@/components/site/site-header";
import { SkipLink } from "@/components/site/skip-link";

/**
 * Shell for signing in: a centered task with no decorative side panel. Pages
 * here are private — each sets `privateMetadata()` (docs/architecture/urls.md).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <FocusedPageCanvas image="/images/showcase/material-sorting.webp">
      <SkipLink />
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col justify-center px-4 py-10 sm:px-8 lg:items-end lg:py-20">
        <main
          id="main"
          tabIndex={-1}
          className="afterlife-task-panel flex w-full max-w-xl min-w-0 flex-col rounded-2xl border border-border bg-card p-6 sm:p-12 lg:me-12"
        >
          {children}
        </main>
      </div>
    </FocusedPageCanvas>
  );
}
