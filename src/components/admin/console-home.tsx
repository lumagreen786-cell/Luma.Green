"use client";

import { useQuery } from "convex/react";
import {
  AlarmClockIcon,
  ArrowRightIcon,
  IndianRupeeIcon,
  LifeBuoyIcon,
  type LucideIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isLocale, localeMeta } from "@/i18n/locales";
import { cn } from "@/lib/utils";

import { api } from "../../../convex/_generated/api";
import { formatPhone, formatWhen } from "./format";

export function ConsoleHome() {
  const me = useQuery(api.identity.me);
  const overview = useQuery(api.admin.overview);
  const summary = useQuery(api.review.summary);
  const firstName = me?.adminName?.split(" ", 1)[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
            {firstName ? `Welcome, ${firstName}` : "Welcome"}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Review requests and track the pilot.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/pilot">
            View pilot report <ArrowRightIcon aria-hidden className="size-4" />
          </Link>
        </Button>
      </div>

      <ul
        className="grid divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        aria-busy={!summary}
      >
        <li>
          <StatLink
            href="/admin/verification"
            icon={ShieldCheckIcon}
            label="Waiting for review"
            value={summary?.waiting}
            hint={
              summary && summary.dueSoon > 0
                ? `${String(summary.dueSoon)} due soon`
                : "Decide within 24 hours"
            }
          />
        </li>
        <li>
          <StatLink
            href="/admin/verification"
            icon={AlarmClockIcon}
            label="Overdue"
            value={summary?.overdue}
            hint="Waiting more than 24 hours"
            isUrgent={Boolean(summary?.overdue)}
          />
        </li>
        <li>
          <StatLink
            href="/admin/support"
            icon={LifeBuoyIcon}
            label="Open support requests"
            value={summary?.openSupport}
            hint="From the help centre and solar page"
          />
        </li>
      </ul>

      <Link
        href="/admin/prices"
        className="group flex items-center gap-4 py-2 transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-10 shrink-0 items-center justify-center text-muted-foreground">
          <IndianRupeeIcon aria-hidden className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">Price tables</span>
          <span className="text-sm text-muted-foreground">
            Minimum and fallback prices per kilo.
          </span>
        </span>
        <ArrowRightIcon
          aria-hidden
          className="size-4 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-0.5"
        />
      </Link>

      <section className="flex min-w-0 flex-col gap-4 border-t border-border pt-6">
        <header className="flex flex-col gap-1.5">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Recent accounts
          </h2>
        </header>
        <div>
          <RecentSignIns people={overview?.recentSignIns} />
        </div>
      </section>
    </div>
  );
}

/** A number that needs the admin, linking to where they deal with it. */
function StatLink({
  href,
  icon: Icon,
  label,
  value,
  hint,
  isUrgent = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  hint: string;
  isUrgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="grid h-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-2 py-5 transition-colors outline-none hover:bg-accent/30 focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex sm:flex-col sm:items-stretch sm:px-5"
    >
      <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {label}
        <Icon
          aria-hidden
          className={cn(
            "size-4",
            isUrgent ? "text-destructive" : "text-muted-foreground",
          )}
        />
      </span>
      {value === undefined ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <span
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            isUrgent && "text-destructive",
          )}
        >
          {value}
        </span>
      )}
      <span className="col-span-2 text-xs text-muted-foreground">{hint}</span>
    </Link>
  );
}

function RecentSignIns({
  people,
}: {
  people:
    | { id: string; phone?: string; locale: string; createdAt: number }[]
    | undefined;
}) {
  if (people === undefined) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (people.length === 0) {
    return (
      <div className="border-b py-6">
        <p className="text-sm font-medium">No account profiles yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          New accounts appear here after their profile is created.
        </p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Phone</TableHead>
          <TableHead>Language</TableHead>
          <TableHead>Profile created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => (
          <TableRow key={person.id}>
            <TableCell className="font-mono">
              {formatPhone(person.phone)}
            </TableCell>
            <TableCell>
              {isLocale(person.locale)
                ? localeMeta[person.locale].english
                : person.locale}
            </TableCell>
            <TableCell>{formatWhen(person.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
