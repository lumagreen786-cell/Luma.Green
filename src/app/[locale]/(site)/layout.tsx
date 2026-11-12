import type { ReactNode } from "react";

import { SectionMotion } from "@/components/motion/section-motion";
import { PublicBottomNav } from "@/components/site/public-bottom-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SkipLink } from "@/components/site/skip-link";

/** Shell for the public site. The signed-in app will get its own. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
        <SectionMotion>{children}</SectionMotion>
      </main>
      <SiteFooter />
      <PublicBottomNav />
    </>
  );
}
