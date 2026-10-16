"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRightIcon, PaperclipIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";

import {
  AppPageHeader,
  EmptyState,
  ListSkeleton,
  StatusPill,
} from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { api } from "../../../../convex/_generated/api";
import { hoursSince, type Sla, slaFor } from "../../../../convex/lib/review";
import { formatPhone, formatWaiting, formatWhen } from "../format";
import { KIND_LABELS } from "../labels";
import { useMinuteClock } from "../use-minute-clock";
import { SlaBadge } from "./sla-badge";

type QueueItem = FunctionReturnType<typeof api.review.queue>[number];

export function reviewHref(id: string): string {
  return `/admin/verification/${id}`;
}

/** Hours waited and the service level, kept current by the clock. */
function liveWait(item: QueueItem, now: number): { hours: number; sla: Sla } {
  const hours =
    now > 0 ? hoursSince(item.waitingSince, now) : item.hoursWaiting;
  return { hours, sla: slaFor(hours) };
}

/** `/admin/verification`: everything waiting on a decision, oldest first. */
export function VerificationQueue() {
  const queue = useQuery(api.review.queue);
  const now = useMinuteClock();
  const next = queue?.find((item) => item.status === "submitted");

  const header = (
    <AppPageHeader
      title="Verification"
      lead="Oldest first. Decide within 24 hours."
      actions={
        next ? (
          <Button asChild>
            <Link href={reviewHref(next.id)}>
              Review next <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
  if (queue === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {header}
        <ListSkeleton rows={3} />
      </div>
    );
  }

  const inReview = queue.filter((item) => item.status === "submitted");
  const withApplicant = queue.filter(
    (item) => item.status === "changes_requested",
  );
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {header}
      <section aria-labelledby="in-review" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="in-review"
            className="font-display text-lg font-semibold tracking-tight"
          >
            In review
          </h2>
          <ReviewTally items={inReview} now={now} />
        </div>
        {inReview.length === 0 ? (
          <EmptyState
            icon={ShieldCheckIcon}
            title="Nothing to review"
            body="New applications appear here as soon as they're sent."
          />
        ) : (
          <QueueList items={inReview} now={now} />
        )}
      </section>
      {withApplicant.length > 0 ? (
        <section
          aria-labelledby="with-applicant"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="with-applicant"
              className="font-display text-lg font-semibold tracking-tight"
            >
              With the applicant
            </h2>
            <p className="text-sm text-muted-foreground">
              Sent back for changes. They come back to review when resubmitted.
            </p>
          </div>
          <QueueList items={withApplicant} now={now} />
        </section>
      ) : null}
    </div>
  );
}

function ReviewTally({
  items,
  now,
}: {
  items: readonly QueueItem[];
  now: number;
}) {
  const slas = items.map((item) => liveWait(item, now).sla);
  const count = (sla: Sla) => slas.filter((value) => value === sla).length;
  const parts = [
    `${String(items.length)} waiting`,
    `${String(count("due_soon"))} due soon`,
    `${String(count("overdue"))} overdue`,
  ];
  return <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>;
}

function WaitBadge({ item, now }: { item: QueueItem; now: number }) {
  const { hours, sla } = liveWait(item, now);
  return item.status === "submitted" ? (
    <SlaBadge sla={sla} hours={hours} />
  ) : (
    <StatusPill tone="info">With applicant · {formatWaiting(hours)}</StatusPill>
  );
}

function RoleLabel({ item }: { item: QueueItem }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {KIND_LABELS[item.kind]}
      {item.version > 1 ? (
        <StatusPill tone="neutral">Version {item.version}</StatusPill>
      ) : null}
    </span>
  );
}

function details(item: QueueItem): string {
  return [item.contactName, item.area, formatPhone(item.phone)]
    .filter(Boolean)
    .join(" · ");
}

function ReviewLink({
  item,
  isWide = false,
}: {
  item: QueueItem;
  isWide?: boolean;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size={isWide ? "lg" : "sm"}
      className={isWide ? "w-full" : undefined}
    >
      <Link href={reviewHref(item.id)} aria-label={`Review ${item.name}`}>
        Review
        <ChevronRightIcon aria-hidden />
      </Link>
    </Button>
  );
}

/** A table on wide screens, divided rows on a phone. */
function QueueList({
  items,
  now,
}: {
  items: readonly QueueItem[];
  now: number;
}) {
  return (
    <>
      <div className="hidden border-y md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-4">Applicant</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Waiting</TableHead>
              <TableHead>
                <span className="sr-only">Files</span>
                <PaperclipIcon aria-hidden className="size-4" />
              </TableHead>
              <TableHead>
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="py-3 ps-4">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {details(item)}
                  </p>
                </TableCell>
                <TableCell>
                  <RoleLabel item={item} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatWhen(item.submittedAt)}
                </TableCell>
                <TableCell>
                  <WaitBadge item={item} now={now} />
                </TableCell>
                <TableCell className="tabular-nums">{item.fileCount}</TableCell>
                <TableCell className="pe-4 text-end">
                  <ReviewLink item={item} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col divide-y border-y md:hidden">
        {items.map((item) => (
          <li key={item.id} className="flex min-w-0 flex-col gap-3 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-foreground">
              <RoleLabel item={item} />
              <WaitBadge item={item} now={now} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-medium break-words">{item.name}</p>
              <p className="text-sm break-words text-muted-foreground">
                {details(item)}
              </p>
              <p className="text-xs text-muted-foreground">
                Sent {formatWhen(item.submittedAt)} ·{" "}
                {item.fileCount === 1
                  ? "1 file"
                  : `${String(item.fileCount)} files`}
              </p>
            </div>
            <ReviewLink item={item} isWide />
          </li>
        ))}
      </ul>
    </>
  );
}
