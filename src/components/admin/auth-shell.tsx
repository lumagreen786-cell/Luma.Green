import { ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
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
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b px-5 sm:min-h-20 sm:px-8">
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
        className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 sm:px-8 sm:py-16"
      >
        <div>
          <div className="mb-6 flex flex-col gap-3 border-b border-border pb-6">
            <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
              {title}
            </h1>
            {description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {children}
        </div>
        <p className="mt-8 flex items-start gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          Phone code and authenticator required for console access.
        </p>
      </main>
    </div>
  );
}
