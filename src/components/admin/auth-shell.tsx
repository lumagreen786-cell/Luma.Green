import { ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { FocusedPageCanvas } from "@/components/site/focused-page-canvas";
import { ThemeToggleControl } from "@/components/theme/theme-toggle";

/** A narrow, distraction-free form; setup and sign-in share the same frame. */
export function AdminAuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <FocusedPageCanvas image="/images/ship-x/admin-background.webp">
      <header className="flex min-h-16 items-center justify-between gap-4 bg-background px-5 text-foreground sm:min-h-20 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label="Luma.Green home"
          className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <ThemeToggleControl
          labels={{
            label: "Appearance",
            light: "Light",
            dark: "Dark",
            system: "System",
          }}
        />
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16 lg:py-20"
      >
        <div className="min-w-0 space-y-5">
          <p className="font-mono text-xs tracking-widest text-white uppercase">
            Administration
          </p>
          <h1 className="font-display text-4xl leading-[1.05] font-normal tracking-tight text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-md text-base leading-relaxed text-white">
              {description}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6 text-card-foreground sm:p-8">
          {children}
          <p className="mt-8 flex items-start gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            Phone code and authenticator required for console access.
          </p>
        </div>
      </main>
    </FocusedPageCanvas>
  );
}
