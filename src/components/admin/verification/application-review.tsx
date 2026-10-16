"use client";

import { useQuery } from "convex/react";
import { ArrowLeftIcon, HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StatusPill } from "@/components/app/page-parts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isLocale, localeMeta } from "@/i18n/locales";

import { api } from "../../../../convex/_generated/api";
import type { ApplicationStatus } from "../../../../convex/lib/lifecycle";
import { indiaToday } from "../../../../convex/lib/onboarding";
import { hoursSince, slaFor } from "../../../../convex/lib/review";
import { FileGallery } from "../files/file-gallery";
import { formatPhone, formatWhen } from "../format";
import { KIND_LABELS, STATUS_LABELS } from "../labels";
import { useMinuteClock } from "../use-minute-clock";
import { ApplicationDetails, changeLabels } from "./application-details";
import { AuditTrail } from "./audit-trail";
import { checklistFor, type ReviewedApplication } from "./checklist";
import { ChecklistCard } from "./checklist-card";
import { DecisionPanel } from "./decision-panel";
import { SlaBadge } from "./sla-badge";

const STATUS_TONES: Record<
  ApplicationStatus,
  "neutral" | "info" | "good" | "warn" | "bad"
> = {
  draft: "neutral",
  submitted: "info",
  changes_requested: "warn",
  approved: "good",
  rejected: "bad",
  suspended: "bad",
};

/**
 * `/admin/verification/{id}`: one application in full — the form, the
 * files, the role's checklist and the decision.
 */
export function ApplicationReview({
  applicationId,
}: {
  applicationId: string;
}) {
  const application = useQuery(api.review.get, { applicationId });
  const now = useMinuteClock();
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());

  if (application === undefined) return <ReviewSkeleton />;
  if (application === null) return <NotFound />;

  const checklist = checklistFor(application);
  const canApprove = checklist.every((item) => checked.has(item.id));
  const toggle = (id: string, isChecked: boolean) => {
    setChecked((current) => {
      const next = new Set(current);
      if (isChecked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <BackLink />
      <ReviewHeader application={application} now={now} />
      <ResubmissionNote application={application} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs defaultValue="application" className="min-w-0">
          <TabsList className="h-auto flex-wrap justify-start gap-2">
            <TabsTrigger value="application">Application</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="application" className="pt-4">
            <ApplicationDetails
              application={application}
              today={indiaToday(now)}
            />
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <FileGallery
              files={application.files}
              emptyText={
                application.kind === "kabadiwala"
                  ? "Kabadiwalas don't upload documents: the checks are the map and a phone call."
                  : "No files attached."
              }
            />
          </TabsContent>
          <TabsContent value="history" className="pt-4">
            <AuditTrail entries={application.audit} />
          </TabsContent>
        </Tabs>
        <aside
          aria-label="Checks and decision"
          className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:self-start xl:border-s xl:ps-6"
        >
          {application.status === "submitted" ? (
            <>
              <ChecklistCard
                items={checklist}
                checked={checked}
                onToggle={toggle}
              />
              <DecisionPanel
                subject={{
                  id: application.id,
                  name: application.name,
                  kind: application.kind,
                }}
                canApprove={canApprove}
              />
            </>
          ) : (
            <DecisionStatus application={application} />
          )}
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/verification"
      className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      Verification queue
    </Link>
  );
}

function ReviewHeader({
  application,
  now,
}: {
  application: ReviewedApplication;
  now: number;
}) {
  const hours =
    application.submittedAt !== undefined && now > 0
      ? hoursSince(application.submittedAt, now)
      : undefined;
  const language = isLocale(application.locale)
    ? localeMeta[application.locale].english
    : application.locale;
  return (
    <div className="flex flex-col gap-4 border-b pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="neutral">{KIND_LABELS[application.kind]}</StatusPill>
        <StatusPill tone={STATUS_TONES[application.status]}>
          {STATUS_LABELS[application.status]}
        </StatusPill>
        {application.version > 1 ? (
          <StatusPill tone="info">Version {application.version}</StatusPill>
        ) : null}
      </div>
      <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight break-words">
        {application.name}
      </h1>
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {application.submittedAt === undefined ? null : (
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Sent</dt>
            <dd>{formatWhen(application.submittedAt)}</dd>
          </div>
        )}
        {hours !== undefined && application.status === "submitted" ? (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Waiting</dt>
            <dd>
              <SlaBadge sla={slaFor(hours)} hours={hours} />
            </dd>
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">Phone</dt>
          <dd>
            {application.phone ? (
              <a
                href={`tel:${application.phone}`}
                className="inline-flex min-h-11 items-center rounded-lg font-mono text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {formatPhone(application.phone)}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">Language</dt>
          <dd>{language}</dd>
        </div>
      </dl>
    </div>
  );
}

/** For a resubmission: what changed, and what the admin had asked for. */
function ResubmissionNote({
  application,
}: {
  application: ReviewedApplication;
}) {
  if (application.version < 2) return null;
  const previous = application.version - 1;
  const labels = changeLabels(application.changes);
  const asked = application.audit.findLast(
    (entry) => entry.action === "application.changes_requested",
  )?.note;
  return (
    <Alert role="status">
      <HistoryIcon aria-hidden />
      <AlertTitle>Sent again: version {application.version}</AlertTitle>
      <AlertDescription>
        <p>
          {labels.length > 0
            ? `Changed since version ${String(previous)}: ${labels.join(", ")}.`
            : `Nothing in the form changed since version ${String(previous)}.`}
        </p>
        {asked ? <p>You had asked: “{asked}”</p> : null}
      </AlertDescription>
    </Alert>
  );
}

const DECIDED_COPY: Record<ApplicationStatus, { title: string; body: string }> =
  {
    draft: {
      title: "Not sent yet",
      body: "The applicant is still filling in the form.",
    },
    submitted: { title: "In review", body: "Waiting for your decision." },
    changes_requested: {
      title: "With the applicant",
      body: "You asked for changes. It comes back to the queue when they send it again.",
    },
    approved: {
      title: "Approved",
      body: "Their business or Saathi profile is open.",
    },
    rejected: {
      title: "Rejected",
      body: "The applicant sees the reason on their status screen.",
    },
    suspended: { title: "Suspended", body: "The account is paused." },
  };

function DecisionStatus({ application }: { application: ReviewedApplication }) {
  const copy = DECIDED_COPY[application.status];
  return (
    <section className="flex min-w-0 flex-col gap-4 border-t border-border pt-6">
      <header className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {copy.title}
        </h2>
        {application.decidedAt === undefined ? null : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Decided {formatWhen(application.decidedAt)}
          </p>
        )}
      </header>
      <div className="flex flex-col gap-3 text-sm">
        <p>{copy.body}</p>
        {application.note ? (
          <blockquote className="border-s border-border ps-3 break-words whitespace-pre-line">
            {application.note}
          </blockquote>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/admin/verification">Back to the queue</Link>
        </Button>
      </div>
    </section>
  );
}

function NotFound() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BackLink />
      <h1 className="text-2xl font-semibold tracking-tight">
        Application not found
      </h1>
      <p className="text-muted-foreground">
        It may have been removed, or the link is wrong.
      </p>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
