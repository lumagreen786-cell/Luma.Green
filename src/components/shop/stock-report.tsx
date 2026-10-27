"use client";

import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { DownloadIcon } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Progress } from "@/components/ui/progress";
import { authClient } from "@/lib/auth-client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useBusiness } from "./use-shop";

/** Remount private state on either account or workspace changes. */
export function StockReport() {
  const business = useBusiness();
  const session = authClient.useSession();
  return !business || !session.data?.user.id ? null : (
    <ReportBody key={`${session.data.user.id}:${business.id}`} />
  );
}

function ReportBody() {
  const t = useTranslations("stockReports");
  const request = useAction(api.reportJobs.request);
  const [jobId, setJobId] = useState<Id<"reportJobs"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"failed" | "unavailable" | null>(null);
  const operationKey = useRef<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const job = useQuery(api.reportJobs.get, jobId ? { jobId } : "skip");
  const now = useNow({ updateInterval: 1000 });
  const isExpired = Boolean(
    job && (job.status === "expired" || job.expiresAt <= now.getTime()),
  );
  const isPending = job?.status === "queued" || job?.status === "running";
  const result = !isExpired && job?.status === "complete" ? job.result : null;

  async function prepare() {
    if (busy || (isPending && !isExpired)) return;
    if (job && (!isPending || isExpired)) operationKey.current = null;
    operationKey.current ??= crypto.randomUUID();
    setBusy(true);
    setError(null);
    setJobId(null);
    try {
      const id = await request({ operationKey: operationKey.current });
      if (mounted.current) setJobId(id);
    } catch (error_) {
      if (mounted.current)
        setError(
          error_ instanceof ConvexError && error_.data === "JOBS_UNAVAILABLE"
            ? "unavailable"
            : "failed",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function download() {
    if (!result || isExpired) return;
    const url = URL.createObjectURL(new Blob([result], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "luma-stock.csv";
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  return (
    <section
      aria-label={t("prepare")}
      className="flex flex-col gap-3 border-t border-border pt-5"
    >
      <p className="text-sm text-muted-foreground">{t("notice")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          isDisabled={busy || (isPending && !isExpired)}
          label={t(busy || (isPending && !isExpired) ? "preparing" : "prepare")}
          onClick={() => {
            void prepare();
          }}
        />
        {result ? (
          <ActionButton
            variant="secondary"
            onClick={download}
            label={t("download")}
            icon={<DownloadIcon aria-hidden className="size-4" />}
          />
        ) : null}
      </div>
      {isPending && !isExpired ? (
        <Progress
          value={job.progress}
          aria-label={t("preparing")}
          className="max-w-sm"
        />
      ) : null}
      {result ? (
        <p role="status" className="text-sm">
          {t("complete")}
        </p>
      ) : null}
      {isExpired ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("expired")}
        </p>
      ) : null}
      {error || job?.status === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error ?? "failed")}
        </p>
      ) : null}
    </section>
  );
}
