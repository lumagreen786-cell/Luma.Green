"use client";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ClipboardListIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { useWorkspace } from "@/components/app/use-workspace";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { Mass } from "@/components/lots/form-parts";
import { NotForYou } from "@/components/shop/guards";
import { useIndiaToday } from "@/components/shop/use-shop";
import { Button } from "@/components/ui/button";
import { useCanOperate } from "@/components/workspace/permissions";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  NewRecord,
  ReferenceAction,
  ReleaseForm,
  RescheduleForm,
} from "./forms";

export function SourcingPage() {
  const w = useWorkspace();
  const t = useTranslations("sourcing");
  const team = useTranslations("workspace");
  if (w === undefined) return <ListSkeleton />;
  if (w?.kind !== "org")
    return (
      <NotForYou
        title={t("title")}
        heading={t("title")}
        body={team("empty")}
        icon={ClipboardListIcon}
      />
    );
  return <SourcingWorkspace key={`${w.org.id}:${w.role}`} />;
}
function SourcingWorkspace() {
  const t = useTranslations("sourcing");
  const isCan = useCanOperate();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AppPageHeader title={t("title")} lead={t("lead")} />
      <p className="text-sm text-muted-foreground">{t("boundary")}</p>
      {isCan ? null : <p>{t("readOnly")}</p>}
      <WorkflowTabs
        items={[
          { value: "board", label: t("board"), content: <DemandBoard /> },
          { value: "plans", label: t("plans"), content: <Plans /> },
          {
            value: "qualifications",
            label: t("qualifications"),
            content: <Qualifications />,
          },
          {
            value: "agreements",
            label: t("agreements"),
            content: <Agreements />,
          },
        ]}
      />
    </div>
  );
}
function Empty() {
  const t = useTranslations("sourcing");
  return <p className="py-4 text-muted-foreground">{t("empty")}</p>;
}
function More({
  status,
  loadMore,
}: {
  status: string;
  loadMore: (count: number) => void;
}) {
  const t = useTranslations("sourcing");
  return status === "CanLoadMore" || status === "LoadingMore" ? (
    <Button
      variant="outline"
      disabled={status === "LoadingMore"}
      onClick={() => {
        loadMore(20);
      }}
    >
      {t("loadMore")}
    </Button>
  ) : null;
}
function QuickAction({
  children,
  run,
}: {
  children: string;
  run: () => Promise<unknown>;
}) {
  const t = useTranslations("sourcing");
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void run()
          .then(() => toast.success(t("saved")))
          .catch(() => toast.error(t("failed")))
          .finally(() => {
            setPending(false);
          });
      }}
    >
      {children}
    </Button>
  );
}
function DemandBoard() {
  const t = useTranslations("sourcing");
  const locale = useLocale();
  const board = useQuery(api.demand.board, {});
  const close = useMutation(api.demand.close);
  const isCan = useCanOperate();
  if (!board) return <ListSkeleton />;
  return (
    <div className="space-y-6 py-4">
      {isCan && board.canPost ? <NewRecord kind="demand" /> : null}
      {(["mine", "available"] as const).map((side) => (
        <section key={side} className="space-y-3">
          <h2 className="font-heading text-lg font-medium">
            {t(side === "mine" ? "myDemand" : "availableDemand")}
          </h2>
          {board[side].length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y border-y">
              {board[side].map((row) => (
                <li key={row.id} className="flex min-w-0 flex-col gap-3 py-5">
                  <h3 className="font-medium">
                    {row.material.names[locale] ||
                      row.material.names.en ||
                      row.material.code}{" "}
                    · {row.buyer.name}
                  </h3>
                  <p>
                    <Mass grams={row.quantityGrams} /> · {row.neededBy} ·{" "}
                    {row.area}
                  </p>
                  <p className="break-words">{row.specification}</p>
                  {side === "mine" && isCan && row.status === "open" ? (
                    <div>
                      <QuickAction run={() => close({ demandId: row.id })}>
                        {t("close")}
                      </QuickAction>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {board.truncated ? <p>{t("limited")}</p> : null}
    </div>
  );
}
function Plans() {
  const today = useIndiaToday();
  const t = useTranslations("sourcing");
  const rows = usePaginatedQuery(
    api.sourcing.plans,
    {},
    { initialNumItems: 20 },
  );
  const publish = useMutation(api.sourcing.publishNext);
  const close = useMutation(api.sourcing.closePlan);
  const isCan = useCanOperate();
  return (
    <div className="space-y-5 py-4">
      {isCan ? <NewRecord kind="plan" /> : null}
      <p className="text-sm text-muted-foreground">{t("planHint")}</p>
      {rows.status === "LoadingFirstPage" ? (
        <ListSkeleton />
      ) : (
        <>
          {rows.results.length === 0 ? <Empty /> : null}
          <ul className="divide-y border-y">
            {rows.results.map((row) => (
              <li key={row._id} className="space-y-3 py-5">
                <h2 className="font-medium">
                  {row.materialCode} · <Mass grams={row.quantityGrams} />
                </h2>
                <p>
                  {t(row.status)} ·{" "}
                  {t(row.everyDays === 7 ? "weekly" : "monthly")} ·{" "}
                  {row.nextNeededBy}
                </p>
                <p className="break-words">{row.specification}</p>
                {row.status === "active" && row.nextNeededBy < today ? (
                  <p className="text-sm text-destructive">{t("overdue")}</p>
                ) : null}
                {isCan && row.status === "active" ? (
                  <div className="flex flex-wrap gap-3">
                    <QuickAction
                      run={() =>
                        publish({
                          planId: row._id,
                          expectedDate: row.nextNeededBy,
                        })
                      }
                    >
                      {t("publish")}
                    </QuickAction>
                    <RescheduleForm
                      planId={row._id}
                      expectedDate={row.nextNeededBy}
                    />
                    <QuickAction run={() => close({ planId: row._id })}>
                      {t("close")}
                    </QuickAction>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
      <More {...rows} />
    </div>
  );
}
function Qualifications() {
  const t = useTranslations("sourcing");
  const format = useFormatter();
  const isCan = useCanOperate();
  const rows = usePaginatedQuery(
    api.sourcing.qualifications,
    {},
    { initialNumItems: 20 },
  );
  return (
    <div className="space-y-5 py-4">
      {isCan ? <NewRecord kind="qualification" /> : null}
      <p className="text-sm text-muted-foreground">{t("privateDecision")}</p>
      {rows.status === "LoadingFirstPage" ? (
        <ListSkeleton />
      ) : (
        <>
          {rows.results.length === 0 ? <Empty /> : null}
          <ul className="divide-y border-y">
            {rows.results.map(({ record: r, supplierName }) => (
              <li key={r._id} className="space-y-2 py-5">
                <h2 className="font-medium">
                  {supplierName} · {r.materialCode}
                </h2>
                <p>
                  {t(r.decision)} · {t("validUntil")}: {r.validUntil}
                </p>
                <p className="break-words">{r.specification}</p>
                <p className="break-words">
                  {r.sampleReference} · {r.reason}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(r.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      <More {...rows} />
    </div>
  );
}
function Agreements() {
  const t = useTranslations("sourcing");
  const isCan = useCanOperate();
  return (
    <div className="space-y-5 py-4">
      {isCan ? <NewRecord kind="agreement" /> : null}
      <WorkflowTabs
        items={(["buying", "supplying"] as const).map((side) => ({
          value: side,
          label: t(side),
          content: <AgreementList side={side} />,
        }))}
      />
    </div>
  );
}
function AgreementList({ side }: { side: "buying" | "supplying" }) {
  const rows = usePaginatedQuery(
    api.sourcing.agreements,
    { side },
    { initialNumItems: 20 },
  );
  return (
    <>
      {rows.status === "LoadingFirstPage" ? (
        <ListSkeleton />
      ) : (
        <>
          {rows.results.length === 0 ? <Empty /> : null}
          <ul className="divide-y border-y">
            {rows.results.map((item) => (
              <AgreementRow key={item.record._id} item={item} side={side} />
            ))}
          </ul>
        </>
      )}
      <More {...rows} />
    </>
  );
}
type AgreementItem = FunctionReturnType<
  typeof api.sourcing.agreements
>["page"][number];
function AgreementRow({
  item,
  side,
}: {
  item: AgreementItem;
  side: "buying" | "supplying";
}) {
  const t = useTranslations("sourcing");
  const format = useFormatter();
  const isCan = useCanOperate();
  const acknowledge = useMutation(api.sourcing.acknowledge);
  const close = useMutation(api.sourcing.closeAgreement);
  const [expanded, setExpanded] = useState(false);
  const r = item.record;
  return (
    <li className="space-y-3 py-5">
      <h2 className="font-medium break-words">
        {r.reference} · {side === "buying" ? item.supplierName : item.buyerName}
      </h2>
      <p>
        {r.materialCode} · <Mass grams={r.quantityGrams} />
      </p>
      <p>
        {t("price")}:{" "}
        {format.number(r.paisePerKg, { maximumFractionDigits: 0 })}
      </p>
      <p>
        {r.startsOn} – {r.endsOn} · {t(r.closed ? "closed" : r.status)}
      </p>
      <p className="break-words">{r.specification}</p>
      <div className="flex flex-wrap gap-3">
        {side === "supplying" && isCan && !r.closed && r.status === "requested"
          ? (["acknowledged", "declined"] as const).map((decision) => (
              <ReferenceAction
                key={decision}
                title={t(
                  decision === "acknowledged" ? "acknowledge" : "decline",
                )}
                hint={t("boundary")}
                onSave={(reference) =>
                  acknowledge({ agreementId: r._id, decision, reference })
                }
              />
            ))
          : null}
        {side === "buying" && isCan && !r.closed ? (
          <>
            {r.status === "acknowledged" ? (
              <ReleaseForm agreementId={r._id} />
            ) : null}
            <ReferenceAction
              title={t("closeAgreement")}
              hint={t("closeHint")}
              onSave={(reference) => close({ agreementId: r._id, reference })}
            />
          </>
        ) : null}
        <Button
          variant="ghost"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          {t("view")}
        </Button>
      </div>
      {expanded ? (
        <AgreementDetail agreementId={r._id} supplier={side === "supplying"} />
      ) : null}
    </li>
  );
}
function AgreementDetail({
  agreementId,
  supplier,
}: {
  agreementId: Id<"sourcingAgreements">;
  supplier: boolean;
}) {
  const t = useTranslations("sourcing");
  const format = useFormatter();
  const isCan = useCanOperate();
  const data = useQuery(api.sourcing.detail, { agreementId });
  const ack = useMutation(api.sourcing.acknowledgeRelease);
  if (!data) return <ListSkeleton />;
  return (
    <div className="space-y-5 border-s-2 ps-4">
      <h3 className="font-medium">{t("releases")}</h3>
      {data.releases.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y">
          {data.releases.map((r) => (
            <li key={r._id} className="space-y-2 py-3">
              <p className="break-words">
                {r.reference} · <Mass grams={r.quantityGrams} /> · {r.neededBy}
              </p>
              <p>{t(r.status)}</p>
              {isCan && supplier && r.status === "requested" ? (
                <div className="flex flex-wrap gap-3">
                  {(["acknowledged", "declined"] as const).map((decision) => (
                    <ReferenceAction
                      key={decision}
                      title={t(
                        decision === "acknowledged" ? "acknowledge" : "decline",
                      )}
                      hint={t("releaseHint")}
                      onSave={(reference) =>
                        ack({ releaseId: r._id, decision, reference })
                      }
                    />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <h3 className="font-medium">{t("history")}</h3>
      <ul className="space-y-3 text-sm">
        {data.events.map((e, index) => (
          <li
            key={`${String(e.createdAt)}:${String(index)}`}
            className="break-words"
          >
            {t(`event.${e.action}`)} · {e.reference} ·{" "}
            {format.dateTime(e.createdAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </li>
        ))}
      </ul>
      {data.truncated ? <p>{t("limited")}</p> : null}
    </div>
  );
}
