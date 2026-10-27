"use client";

import { useQuery } from "convex/react";
import {
  ChartNoAxesCombinedIcon,
  CreditCardIcon,
  HouseIcon,
  IndianRupeeIcon,
  LifeBuoyIcon,
  LogOutIcon,
  type LucideIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import { QueryProvider } from "@/components/providers/query-provider";
import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { ThemeToggleControl } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { api } from "../../../convex/_generated/api";
import { useAdminSignOut } from "./use-admin-sign-out";

interface NavItem {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  /** A number from `review.summary` to show beside the label. */
  count?: { key: "waiting" | "openSupport"; label: string };
}

const nav: readonly NavItem[] = [
  { href: "/admin", label: "Home", icon: HouseIcon },
  {
    href: "/admin/verification",
    label: "Verification",
    mobileLabel: "Review",
    icon: ShieldCheckIcon,
    count: { key: "waiting", label: "waiting for review" },
  },
  { href: "/admin/prices", label: "Prices", icon: IndianRupeeIcon },
  {
    href: "/admin/account-removals",
    label: "Account removal",
    mobileLabel: "Accounts",
    icon: ShieldCheckIcon,
  },
  {
    href: "/admin/operations",
    label: "Material review",
    mobileLabel: "Materials",
    icon: ShieldCheckIcon,
  },
  {
    href: "/admin/payments",
    label: "Payment setup",
    mobileLabel: "Payments",
    icon: CreditCardIcon,
  },
  {
    href: "/admin/pilot",
    label: "Pilot numbers",
    mobileLabel: "Pilot",
    icon: ChartNoAxesCombinedIcon,
  },
  {
    href: "/admin/support",
    label: "Support",
    icon: LifeBuoyIcon,
    count: { key: "openSupport", label: "open" },
  },
];

/** Home only on its own page; every other section on its sub-pages too. */
function isCurrent(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Every console page sits inside this. The server layout has already checked
 * there's a session; this checks it's the admin with an authenticator, and
 * Convex checks again on every query.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const me = useSignedInQuery(api.identity.me);

  let redirectTo: string | null = null;
  if (me === null) redirectTo = "/admin/login";
  else if (me?.kind === "admin" && (!me.twoFactorEnabled || !me.adminName)) {
    redirectTo = "/admin/setup";
  }

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (me === undefined || me === null || redirectTo) {
    return <ConsoleSkeleton />;
  }
  if (me.kind !== "admin") return <NotAdmin />;

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <Sidebar name={me.adminName ?? "Admin"} />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12 lg:py-10"
      >
        <QueryProvider>{children}</QueryProvider>
      </main>
    </div>
  );
}

function Sidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const summary = useQuery(api.review.summary);
  const { signOut, busy, error } = useAdminSignOut();

  return (
    <aside className="flex flex-col gap-3 border-b border-sidebar-border bg-muted/35 px-3 pt-3 pb-2 text-sidebar-foreground lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:shrink-0 lg:gap-6 lg:overflow-y-auto lg:border-e lg:border-b-0 lg:px-5 lg:py-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/admin"
          aria-label="Admin home"
          className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Admin</Badge>
          <div className="flex items-center gap-1 lg:hidden">
            <ThemeToggleControl
              labels={{
                label: "Appearance",
                light: "Light",
                dark: "Dark",
                system: "System",
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Sign out ${name}`}
              disabled={busy}
              onClick={() => {
                void signOut();
              }}
            >
              <LogOutIcon aria-hidden />
            </Button>
          </div>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="hidden items-center justify-between gap-3 border-y border-sidebar-border py-2 lg:flex">
        <span className="text-xs font-medium text-muted-foreground">
          Admin console
        </span>
        <ThemeToggleControl
          labels={{
            label: "Appearance",
            light: "Light",
            dark: "Dark",
            system: "System",
          }}
        />
      </div>
      <nav aria-label="Admin">
        <ul className="grid grid-cols-3 gap-x-2 sm:grid-cols-4 lg:flex lg:flex-col lg:gap-1">
          {nav.map((item) => {
            const isActive = isCurrent(pathname, item.href);
            const count = item.count ? summary?.[item.count.key] : undefined;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-b-2 border-transparent px-1 py-2 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:border-s-2 lg:border-b-0 lg:px-3 lg:text-sm",
                    isActive
                      ? "border-b-primary bg-background font-semibold text-primary lg:border-s-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <item.icon
                    aria-hidden
                    className="size-5 shrink-0 lg:size-4"
                  />
                  {item.mobileLabel ? (
                    <>
                      <span className="lg:hidden">{item.mobileLabel}</span>
                      <span className="hidden lg:inline">{item.label}</span>
                    </>
                  ) : (
                    <span>{item.label}</span>
                  )}
                  {count && item.count ? (
                    <span className="absolute end-0 top-0 min-w-4 rounded-full bg-primary px-1 text-center text-xs leading-4 font-medium text-primary-foreground tabular-nums lg:static lg:ms-auto lg:px-1.5 lg:leading-5">
                      {count}
                      <span className="sr-only"> {item.count.label}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto hidden flex-col gap-4 border-t border-sidebar-border pt-4 lg:flex">
        <p className="truncate text-sm font-medium">{name}</p>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 text-foreground"
          disabled={busy}
          onClick={() => {
            void signOut();
          }}
        >
          <LogOutIcon aria-hidden />
          Sign out
        </Button>
      </div>
    </aside>
  );
}

function NotAdmin() {
  const { signOut, busy, error } = useAdminSignOut();
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10"
    >
      <h1 className="text-xl font-semibold">This area is for the admin</h1>
      <p className="text-muted-foreground">
        You&apos;re signed in with a phone number, which can&apos;t open the
        admin console.
      </p>
      <Button
        variant="outline"
        className="self-start"
        onClick={() => {
          void signOut();
        }}
        disabled={busy}
      >
        Sign out
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function ConsoleSkeleton() {
  return (
    <div
      className="flex min-h-dvh flex-col bg-background lg:flex-row"
      aria-busy="true"
    >
      <div className="border-b bg-background p-4 lg:w-72 lg:border-e lg:border-b-0">
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6 lg:p-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
