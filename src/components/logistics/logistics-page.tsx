"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { RouteIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { RecordWorkspace } from "@/components/app/record-workspace";
import { useWorkspace } from "@/components/app/use-workspace";
import { EvidenceDialog, LotField, Mass } from "@/components/lots/form-parts";
import { NotForYou } from "@/components/shop/guards";
import { Button } from "@/components/ui/button";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { PlanForm } from "./plan-form";

export function LogisticsPage() {
  const workspace = useWorkspace();
  const t = useTranslations("logistics");
  const lots = useTranslations("lots");
  if (workspace === undefined) return <ListSkeleton />;
  if (workspace?.kind !== "org")
    return (
      <NotForYou
        title={t("title")}
        heading={t("title")}
        body={lots("notBusiness")}
        icon={RouteIcon}
      />
    );
  return (
    <LogisticsWorkspace
      key={`${workspace.org.id}:${workspace.role}`}
      operate={workspace.role !== "viewer"}
      manage={workspace.role === "owner" || workspace.role === "admin"}
    />
  );
}
function LogisticsWorkspace({
  operate,
  manage,
}: {
  operate: boolean;
  manage: boolean;
}) {
  const t = useTranslations("logistics");
  const lots = useTranslations("lots");
  const more = useTranslations("notifications");
  const [selected, setSelected] = useState<Id<"routePlans"> | null>(null);
  const { results, status, loadMore } = usePaginatedQuery(
    api.routePlans.mine,
    {},
    { initialNumItems: 20 },
  );
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AppPageHeader
        title={t("title")}
        lead={t("lead")}
        actions={operate ? <PlanForm /> : undefined}
      />
      {operate ? null : (
        <p className="text-sm text-muted-foreground">{lots("readOnly")}</p>
      )}
      <RecordWorkspace
        detailKey={selected ?? undefined}
        onBack={() => {
          setSelected(null);
        }}
        list={
          <div className="space-y-5">
            {" "}
            {status === "LoadingFirstPage" ? (
              <ListSkeleton />
            ) : (
              <ul className="divide-y border-y">
                {results.map((plan) => (
                  <li
                    key={plan._id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium break-words">{plan.title}</p>
                      <p className="text-sm break-words text-muted-foreground">
                        {plan.reference} ·{" "}
                        {t("revision", { number: plan.revision })}
                        {plan.status === "archived"
                          ? ` · ${t("archived")}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(plan._id);
                      }}
                    >
                      {t("history")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {status !== "LoadingFirstPage" && results.length === 0 ? (
              <p>{t("empty")}</p>
            ) : null}
            {status === "CanLoadMore" ? (
              <Button
                variant="outline"
                onClick={() => {
                  loadMore(20);
                }}
              >
                {more("loadMore")}
              </Button>
            ) : null}
          </div>
        }
        detail={
          selected ? (
            <PlanDetail
              key={selected}
              id={selected}
              operate={operate}
              manage={manage}
            />
          ) : null
        }
      />
    </div>
  );
}
function Version({ version }: { version: Doc<"routePlanVersions"> }) {
  const t = useTranslations("logistics");
  const format = useFormatter();
  return (
    <section className="space-y-3 border-t py-5">
      <h3 className="font-medium">
        {t("revision", { number: version.revision })} · {version.title}
      </h3>
      <p className="text-sm">{version.reason}</p>
      <p>
        {version.vehicleReference} · <Mass grams={version.totalGrams} /> /{" "}
        <Mass grams={version.capacityGrams} />
      </p>
      <p className="text-sm">
        {t("origin")}: {version.origin.siteReference}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("distance", { value: format.number(version.straightLineMeters) })} ·{" "}
        {t(version.ordering)}
      </p>
      <ol className="space-y-2">
        {version.orderIndices.map((index, sequence) => {
          const stop = version.stops[index];
          return (
            <li key={index} className="text-sm break-words">
              {t("stop", { number: sequence + 1 })}: {stop.siteReference} ·{" "}
              {version.materialCodes[index]} · <Mass grams={stop.grams} /> ·{" "}
              {format.number(stop.latitude, { maximumFractionDigits: 6 })},{" "}
              {format.number(stop.longitude, { maximumFractionDigits: 6 })}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
function PlanDetail({
  id,
  operate,
  manage,
}: {
  id: Id<"routePlans">;
  operate: boolean;
  manage: boolean;
}) {
  const detail = useQuery(api.routePlans.detail, { planId: id });
  const history = usePaginatedQuery(
    api.routePlans.history,
    { planId: id },
    { initialNumItems: 10 },
  );
  const t = useTranslations("logistics");
  const more = useTranslations("notifications");
  if (!detail) return <ListSkeleton />;
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl">{detail.plan.title}</h2>
      {detail.plan.status === "active" ? (
        <div className="flex flex-wrap gap-3">
          {operate ? <PlanForm detail={detail} /> : null}
          {manage ? <ArchivePlan plan={detail.plan} /> : null}
        </div>
      ) : (
        <p>
          {t("archived")}: {detail.plan.archiveReason}
        </p>
      )}
      <h2 className="font-medium">{t("history")}</h2>
      {history.results.map((version) => (
        <Version key={version._id} version={version} />
      ))}
      {history.status === "CanLoadMore" ? (
        <Button
          variant="outline"
          onClick={() => {
            history.loadMore(10);
          }}
        >
          {more("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
function ArchivePlan({ plan }: { plan: Doc<"routePlans"> }) {
  const t = useTranslations("logistics");
  const common = useTranslations("common");
  const archive = useMutation(api.routePlans.archive);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [expectedRevision, setExpectedRevision] = useState(plan.revision);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit() {
    setBusy(true);
    setFailed(false);
    try {
      await archive({
        planId: plan._id,
        expectedRevision,
        reason,
      });
      setOpen(false);
    } catch {
      setFailed(true);
      toast.error(common("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <EvidenceDialog
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      onOpen={() => {
        setExpectedRevision(plan.revision);
        setOpen(true);
      }}
      title={t("archive")}
      hint={t("lead")}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <LotField
          label={t("reason")}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          minLength={3}
          maxLength={200}
          required
        />
        {failed ? <p role="alert">{t("conflict")}</p> : null}
        <Button disabled={busy} type="submit">
          {t("archive")}
        </Button>
      </form>
    </EvidenceDialog>
  );
}
