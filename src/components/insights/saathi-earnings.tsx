"use client";

import {
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import {
  DemoNote,
  EmptyState,
  Section,
  StatCard,
} from "@/components/app/page-parts";
import { DoneJobRow } from "@/components/saathi/done-job-row";
import { WORK_ICONS } from "@/components/saathi/job-meta";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { BarList } from "./bar-list";
import type { SaathiImpact } from "./types";

/** A Saathi's side of the impact screen: what they've earned, job by job. */
export function SaathiEarnings({ impact }: { impact: SaathiImpact }) {
  const t = useTranslations("impact.saathi");
  const work = useTranslations("saathi.work");
  const format = useFormat();

  if (impact.jobsDone === 0) {
    return (
      <EmptyState
        icon={BriefcaseBusinessIcon}
        title={t("empty")}
        body={t("emptyBody")}
        action={
          <Button asChild size="lg" className="mt-2 h-12 text-base">
            <Link href="/app">{t("findJob")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label={t("total")}
          value={format.money(impact.totalPaise)}
          hint={t("jobsDone", { count: impact.jobsDone })}
          icon={WalletIcon}
          tone="good"
        />
        <StatCard
          label={t("week")}
          value={format.money(impact.weekPaise)}
          hint={t("weekHint", { count: impact.weekJobs })}
          icon={CalendarDaysIcon}
        />
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Section title={t("history")}>
            <ul className="flex min-w-0 flex-col">
              {impact.recent.map((job) => (
                <DoneJobRow key={job.id} job={job} />
              ))}
            </ul>
          </Section>
        </div>
        <div className="min-w-0 space-y-4">
          {impact.byKind.length > 1 ? (
            <Section title={t("byKind")}>
              <BarList
                label={t("byKind")}
                rows={impact.byKind.map((row) => ({
                  key: row.kind,
                  label: work(row.kind),
                  icon: WORK_ICONS[row.kind],
                  value: row.paise,
                  display: format.money(row.paise),
                  detail: t("jobs", { count: row.jobs }),
                }))}
              />
            </Section>
          ) : null}

          <Button asChild className="w-full">
            <Link href="/app">{t("findJob")}</Link>
          </Button>
        </div>
      </div>

      <DemoNote>{t("demoNote")}</DemoNote>
    </>
  );
}
