"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { convexSiteUrlFrom } from "@/lib/convex-urls";
import { clientEnv } from "@/lib/env";
import { type HealthSnapshot, readServiceStatus } from "@/lib/service-status";

export function ServiceStatus() {
  const t = useTranslations("serviceStatus");
  const format = useFormatter();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<HealthSnapshot | null>(null);
  const [state, setState] = useState<"checking" | "up" | "down">("checking");
  useEffect(() => {
    const url =
      clientEnv.NEXT_PUBLIC_CONVEX_SITE_URL ??
      (clientEnv.NEXT_PUBLIC_CONVEX_URL
        ? convexSiteUrlFrom(clientEnv.NEXT_PUBLIC_CONVEX_URL)
        : null);
    let isActive = true;
    let request: AbortController | undefined;
    async function check() {
      request?.abort();
      request = new AbortController();
      const timeout = setTimeout(() => request?.abort(), 8000);
      setState("checking");
      setResult(null);
      try {
        if (!url) throw new Error("Not configured");
        const snapshot = await readServiceStatus(
          `${url}/health`,
          request.signal,
        );
        if (isActive) {
          setResult(snapshot);
          setState("up");
        }
      } catch {
        if (isActive) setState("down");
      } finally {
        clearTimeout(timeout);
      }
    }
    void check();
    const interval = setInterval(() => {
      void check();
    }, 30_000);
    return () => {
      isActive = false;
      request?.abort();
      clearInterval(interval);
    };
  }, [revision]);
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-x-16 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <Activity
        aria-hidden="true"
        className="mb-6 size-8 text-foreground lg:col-start-1"
      />
      <h1 className="text-4xl font-normal tracking-tight sm:text-6xl lg:col-start-1">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground lg:col-start-1">
        {t("lead")}
      </p>
      <div
        role="status"
        className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mt-0"
      >
        <dl className="divide-y divide-border">
          <StatusRow label={t("website")} value={t("up")} />
          <StatusRow label={t("api")} value={t(state)} />
          <StatusRow label={t("sms")} value={t(result?.sms ?? "unknown")} />
        </dl>
        {result ? (
          <p className="mt-5 text-sm text-muted-foreground lg:col-start-1">
            {t("checkedAt", {
              time: format.dateTime(result.checkedAt, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            })}
          </p>
        ) : null}
      </div>
      <p className="mt-5 text-sm text-muted-foreground lg:col-start-1">
        {t("note")}
      </p>
      <Button
        className="mt-6 min-h-11 w-fit lg:col-start-1"
        variant="outline"
        disabled={state === "checking"}
        onClick={() => {
          setRevision((value) => value + 1);
        }}
      >
        <RefreshCw aria-hidden="true" className="size-4" />
        {t("refresh")}
      </Button>
    </section>
  );
}
function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-5">
      <dt className="font-medium">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
