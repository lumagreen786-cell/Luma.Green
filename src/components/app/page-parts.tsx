import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Building blocks every app screen uses, so they all look alike. */

export function AppPageHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="grid min-w-0 gap-4 border-b border-border pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
          {title}
        </h1>
        {lead ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {lead}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:max-w-md lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border-s-2 border-border py-1 ps-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <Icon
            aria-hidden
            className={cn(
              "size-5 shrink-0",
              tone === "good" && "text-primary",
              tone === "warn" && "text-amber-700 dark:text-amber-300",
              tone === "neutral" && "text-muted-foreground",
            )}
          />
        ) : null}
      </div>
      <p className="text-2xl font-semibold tracking-tight break-words tabular-nums">
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 border-b border-border py-8">
      <span className="row-span-2 text-muted-foreground">
        <Icon aria-hidden className="size-6" strokeWidth={1.75} />
      </span>
      <p className="font-display text-lg font-semibold tracking-tight">
        {title}
      </p>
      {body ? (
        <p className="col-start-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      ) : null}
      {action ? <div className="col-start-2 mt-2">{action}</div> : null}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-none" />
      ))}
    </div>
  );
}

/** An open settings row: purpose on the reading rail, controls beside it. */
export function SettingsSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid min-w-0 gap-4 border-t border-border pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-8"
    >
      <h2 id={id} className="font-display text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** A small coloured pill for a status. */
export function StatusPill({
  tone,
  children,
}: {
  tone: "neutral" | "info" | "good" | "warn" | "bad";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md px-2 py-1 text-xs leading-5 font-medium",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "info" && "bg-sky-500/10 text-sky-800 dark:text-sky-300",
        tone === "good" && "bg-primary/10 text-primary",
        tone === "warn" && "bg-amber-500/10 text-amber-800 dark:text-amber-300",
        tone === "bad" && "bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

/** "Sample data" ribbon for prototype-only numbers. */
export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-s-2 border-amber-500/50 ps-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
