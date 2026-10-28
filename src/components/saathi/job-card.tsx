"use client";

import { MapPinIcon, StoreIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useFormat } from "@/components/app/format";
import { StatusPill } from "@/components/app/page-parts";

import { type Job, WINDOW_ICONS, WORK_ICONS } from "./job-meta";
import { useJobWhen } from "./use-job-when";

/** Ids of a job card's kind and title, which together name the job. */
function jobIds(job: Pick<Job, "id">) {
  return { kind: `job-${job.id}-kind`, title: `job-${job.id}-title` };
}

/** For `aria-labelledby`/`aria-describedby`: "Pickups from homes, …". */
export function jobLabelledBy(job: Pick<Job, "id">): string {
  const ids = jobIds(job);
  return `${ids.kind} ${ids.title}`;
}

/**
 * One job, big and plain: what, when, where, for whom and the pay — and the
 * one thing to do about it (`action`) underneath.
 */
export function JobCard({
  job,
  today,
  action,
}: {
  job: Job;
  today: string;
  action?: ReactNode;
}) {
  const t = useTranslations("saathi");
  const payment = useTranslations("collectionOperations");
  const format = useFormat();
  const when = useJobWhen();
  const KindIcon = WORK_ICONS[job.kind];
  const WindowIcon = WINDOW_ICONS[job.window];
  const isLate = job.status === "assigned" && job.date < today;
  const ids = jobIds(job);

  return (
    <article
      aria-labelledby={jobLabelledBy(job)}
      className="grid min-w-0 grid-cols-1 gap-4 border-b border-border py-5 md:grid-cols-[minmax(0,1fr)_minmax(14rem,max-content)]"
    >
      <div className="flex items-start gap-3 md:col-span-2">
        <span className="flex size-10 shrink-0 items-center justify-center text-primary">
          <KindIcon aria-hidden className="size-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 id={ids.kind} className="text-base leading-snug font-semibold">
              {t(`work.${job.kind}`)}
            </h3>
            <p className="shrink-0 text-lg leading-snug font-semibold tabular-nums">
              <span className="sr-only">{t("pay")} </span>
              {format.money(job.payPaise)}
            </p>
          </div>
          <p id={ids.title} className="text-sm text-muted-foreground">
            {job.title}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex flex-wrap items-center gap-2">
          <WindowIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span>{when(job, today)}</span>
          {isLate ? <StatusPill tone="warn">{t("late")}</StatusPill> : null}
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <MapPinIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span>{job.area}</span>
          {job.inMyArea ? (
            <StatusPill tone="good">{t("nearYou")}</StatusPill>
          ) : null}
        </li>
        {job.postedBy ? (
          <li className="flex items-center gap-2">
            <StoreIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span>{t("postedBy", { name: job.postedBy.name })}</span>
          </li>
        ) : null}
      </ul>

      <p className="text-sm text-muted-foreground">{payment("fixedFee")}</p>
      {job.paymentDueDate ? (
        <p className="text-sm">
          {payment("due", { date: job.paymentDueDate })}
        </p>
      ) : null}
      {action ? (
        <div className="flex flex-col justify-end">{action}</div>
      ) : null}
    </article>
  );
}
