import type { ReactNode } from "react";

import { SectionMotion } from "@/components/motion/section-motion";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SkipLink } from "@/components/site/skip-link";

/** Resolve the real async site chrome before rendering this isolated client fixture. */
export async function SiteFixtureLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      {await SiteHeader()}
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
        <SectionMotion>{children}</SectionMotion>
      </main>
      {await SiteFooter()}
    </>
  );
}

/** Same auth layout, with its async server header resolved for the fixture. */
export async function AuthFixtureLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      {await SiteHeader()}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-8 sm:px-8 sm:py-12">
        <main
          id="main"
          tabIndex={-1}
          className="flex w-full min-w-0 flex-col rounded-xl border border-border/60 bg-card p-5 sm:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
