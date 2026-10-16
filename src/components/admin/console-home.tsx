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
  const overview = useQuery(api.admin.overview);
  const summary = useQuery(api.review.summary);
  const queue = useQuery(api.review.queue);
  const nextReviews = queue
    ?.filter((item) => item.status === "submitted")
    .slice(0, 3);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">
            Work queue
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/pilot">
            View pilot report <ArrowRightIcon aria-hidden className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
        <section aria-labelledby="next-reviews" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <h2
              id="next-reviews"
              className="font-display text-xl font-semibold"
            >
              Next reviews
            </h2>
            <Button asChild>
              <Link href="/admin/verification">
                Review applications <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          {nextReviews === undefined ? (
            <Skeleton className="mt-4 h-32 w-full" />
          ) : null}
          {nextReviews?.length === 0 ? (
            <p className="py-8 text-muted-foreground">
              No applications waiting for review.
            </p>
          ) : null}
          <ol className="divide-y border-b">
            {nextReviews?.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/verification/${item.id}`}
                  className="flex min-h-20 items-center justify-between gap-4 py-4 outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold break-words">
                      {item.name}
                    </span>{" "}
                    <span className="block text-sm text-muted-foreground">
                      {item.area}
                    </span>
                  </span>
                  <ArrowRightIcon aria-hidden className="size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-2 gap-6 pt-4" aria-busy={!summary}>
            <StatLink
              href="/admin/verification"
              icon={ShieldCheckIcon}
              label="Waiting for review"
              value={summary?.waiting}
              hint="Decide within 24 hours"
            />
            <StatLink
              href="/admin/verification"
              icon={AlarmClockIcon}
              label="Overdue"
              value={summary?.overdue}
              hint="Waiting more than 24 hours"
              isUrgent={Boolean(summary?.overdue)}
            />
          </div>
        </section>
        <section
          aria-label="Other tasks"
          className="flex min-w-0 flex-col border-t lg:border-s lg:border-t-0 lg:ps-8"
        >
          <StatLink
            href="/admin/support"
            icon={LifeBuoyIcon}
            label="Open support requests"
            value={summary?.openSupport}
            hint="Open support inbox"
          />
          <Link
            href="/admin/prices"
            className="flex min-h-16 items-center gap-3 border-t py-4 font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <IndianRupeeIcon aria-hidden className="size-5" />
            Price tables
            <ArrowRightIcon aria-hidden className="ms-auto size-4" />
          </Link>
          <Link
            href="/admin/operations"
            className="flex min-h-16 items-center gap-3 border-t py-4 font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ShieldCheckIcon aria-hidden className="size-5" />
            Material review
            <ArrowRightIcon aria-hidden className="ms-auto size-4" />
          </Link>
        </section>
      </div>

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
      className="flex h-full flex-col gap-2 py-4 transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
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
