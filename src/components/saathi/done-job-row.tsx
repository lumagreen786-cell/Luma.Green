"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import { ActionButton } from "@/components/ui/action-button";

import { api } from "../../../convex/_generated/api";
import { type Job, WORK_ICONS } from "./job-meta";
import { useJobWhen } from "./use-job-when";

/** A finished job in a list of earnings: what, when, where, for whom, pay. */
export function DoneJobRow({ job }: { job: Job }) {
  const t = useTranslations("saathi");
  const payment = useTranslations("collectionOperations");
  const common = useTranslations("common");
  const acknowledge = useMutation(api.saathi.acknowledgePayment);
  const format = useFormat();
  const when = useJobWhen();
  const Icon = WORK_ICONS[job.kind];

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border py-4">
      <span className="flex size-10 shrink-0 items-center justify-center text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-medium">{t(`work.${job.kind}`)}</p>
        <p className="text-sm text-muted-foreground">
          {t("whenWhere", { when: when(job), area: job.area })}
        </p>
        {job.postedBy ? (
          <p className="text-sm text-muted-foreground">
            {t("postedBy", { name: job.postedBy.name })}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 font-semibold tabular-nums">
        <span className="sr-only">{t("pay")} </span>
        {format.money(job.payPaise)}
      </p>
      {job.employerPaidAt && !job.workerAcknowledgedAt ? (
        <ActionButton
          onClick={() => {
            void acknowledge({ jobId: job.id }).catch(() =>
              toast.error(common("error")),
            );
          }}
          label={payment("acknowledge")}
        />
      ) : null}
      {job.workerAcknowledgedAt ? <p>{payment("acknowledged")}</p> : null}
    </li>
  );
}
