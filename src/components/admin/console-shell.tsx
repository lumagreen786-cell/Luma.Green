"use client";

import { useQuery } from "convex/react";
import {
  AlertCircleIcon,
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
    <div className="flex min-h-dvh flex-col bg-background">
      <ConsoleNavigation name={me.adminName ?? "Admin"} />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[100rem] min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12 lg:py-10"
      >
        <QueryProvider>{children}</QueryProvider>
      </main>
    </div>
  );
}

function ConsoleNavigation({ name }: { name: string }) {
  const pathname = usePathname();
  const summary = useQuery(api.review.summary);
  const { signOut, busy, error } = useAdminSignOut();

  return (
    <header className="bg-sidebar px-4 py-4 text-sidebar-foreground sm:px-8">
      <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-3 pb-4">
        <Link
          href="/admin"
          aria-label="Admin home"
          className="inline-flex min-h-11 items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring"
        >
          <Logo />
        </Link>
        <Badge
          variant="outline"
          className="border-sidebar-border text-sidebar-foreground"
        >
          Admin
        </Badge>
        <p className="ms-auto hidden truncate text-sm font-medium sm:block">
          {name}
        </p>
        <Button
          variant="ghost"
          className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring"
          aria-label={`Sign out ${name}`}
          disabled={busy}
          onClick={() => void signOut()}
        >
          <LogOutIcon aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="mx-auto mb-3 flex max-w-[96rem] items-start gap-2 rounded-xl border border-sidebar-ring bg-card p-3 text-sm text-foreground"
        >
          <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
      <nav
        aria-label="Admin"
        className="mx-auto max-w-[96rem] overflow-x-auto overscroll-x-contain pb-1"
      >
        <ul className="flex w-max min-w-full items-center gap-2">
          {nav.map((item) => {
            const isActive = isCurrent(pathname, item.href);
            const count = item.count ? summary?.[item.count.key] : undefined;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring",
                    isActive
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
    </header>
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
    <div className="flex min-h-dvh flex-col bg-background" aria-busy="true">
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
