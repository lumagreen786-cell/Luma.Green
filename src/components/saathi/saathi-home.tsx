"use client";

import { useQuery } from "convex/react";
import { CalendarCheckIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  AppPageHeader,
  DemoNote,
  EmptyState,
  ListSkeleton,
  Section,
} from "@/components/app/page-parts";
import { useWorkspace } from "@/components/app/use-workspace";
import { WorkerHandovers } from "@/components/collection/worker-handovers";
import { QueryBoundary } from "@/components/insights/query-boundary";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../../convex/_generated/api";
import { FinishJobButton, TakeJobButton } from "./job-actions";
import { JobCard } from "./job-card";
import { splitByDay } from "./job-day";
import { WeekEarnings } from "./week-earnings";

function JobGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-28 w-full rounded-none" />
      <ListSkeleton rows={2} />
    </div>
  );
}

function SaathiBoard() {
  const t = useTranslations("saathi");
  const board = useQuery(api.saathi.board);
  if (board === undefined) return <BoardSkeleton />;

  const { now, later } = splitByDay(board.mine, board.today);
  return (
    <>
      <Section title={t("today.title")}>
        {now.length > 0 ? (
          <JobGrid>
            {now.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                today={board.today}
                action={<FinishJobButton job={job} />}
              />
            ))}
          </JobGrid>
        ) : (
          <EmptyState
            icon={CalendarCheckIcon}
            title={t("today.empty")}
            body={t("today.emptyBody")}
          />
        )}
      </Section>

      {later.length > 0 ? (
        <Section title={t("upcoming.title")}>
          <JobGrid>
            {later.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                today={board.today}
                action={
                  <p className="text-sm text-muted-foreground">
                    {t("upcoming.hint")}
                  </p>
                }
              />
            ))}
          </JobGrid>
        </Section>
      ) : null}

      <Section title={t("open.title")}>
        {board.open.length > 0 ? (
          <>
            <p className="-mt-1 text-sm text-muted-foreground">
              {t("open.lead")}
            </p>
            <JobGrid>
              {board.open.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  today={board.today}
                  action={<TakeJobButton job={job} />}
                />
              ))}
            </JobGrid>
          </>
        ) : (
          <EmptyState
            icon={SearchIcon}
            title={t("open.empty")}
            body={t("open.emptyBody")}
          />
        )}
      </Section>

      <WeekEarnings earnings={board.earnings} />
      <WorkerHandovers />
      <DemoNote>{t("demoNote")}</DemoNote>
    </>
  );
}

/**
 * `/app` for a Saathi: this week's pay, today's jobs to mark done, and open
 * jobs to take — their own area first. Big targets, few words.
 */
export function SaathiHome() {
  const t = useTranslations("saathi");
  const workspace = useWorkspace();
  const saathi = workspace?.kind === "saathi" ? workspace.saathi : null;

  return (
    <>
      <div className="min-w-0">
        <AppPageHeader
          title={t("greeting", { name: saathi?.name ?? "" })}
          lead={saathi ? t("lead", { area: saathi.area }) : undefined}
        />
      </div>
      <QueryBoundary>
        <SaathiBoard />
      </QueryBoundary>
    </>
  );
}
