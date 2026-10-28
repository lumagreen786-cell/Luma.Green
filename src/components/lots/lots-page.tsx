"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { PackageIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { NotForYou } from "@/components/shop/guards";
import { useBusiness } from "@/components/shop/use-shop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCanOperate } from "@/components/workspace/permissions";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { requiresControlledRoute } from "../../../convex/lib/industrialClassification";
import {
  ProcessingCostSummary,
  RecordAcquisitionCost,
  RecordedCost,
} from "./cost-parts";
import { Mass } from "./form-parts";
import { Inspections } from "./inspections";
import { LotQueryBoundary } from "./lot-boundary";
import {
  DeclareLot,
  DispatchLot,
  ReceiveLot,
  RecordDisposition,
  TransformLot,
} from "./lot-forms";

function LotAccess({ children }: { children: ReactNode }) {
  const business = useBusiness();
  const t = useTranslations("lots");
  if (business === undefined) return <ListSkeleton />;
  if (!business)
    return (
      <NotForYou
        title={t("title")}
        icon={PackageIcon}
        heading={t("title")}
        body={t("notBusiness")}
      />
    );
  return <LotQueryBoundary key={business.id}>{children}</LotQueryBoundary>;
}
export function LotsPage() {
  return (
    <LotAccess>
      <LotLists />
    </LotAccess>
  );
}
function LotLists() {
  const t = useTranslations("lots");
  const canOperate = useCanOperate();
  return (
    <div className="flex flex-col gap-7">
      <AppPageHeader
        title={t("title")}
        lead={t("lead")}
        actions={<DeclareLot />}
      />
      <p className="max-w-3xl text-sm text-muted-foreground">
        {t("evidenceNote")}
      </p>
      {canOperate ? null : <p className="text-sm">{t("readOnly")}</p>}
      <WorkflowTabs
        defaultValue="held"
        items={[
          {
            value: "incoming",
            label: t("incoming"),
            content: <IncomingLots />,
          },
          { value: "held", label: t("held"), content: <HeldLots /> },
          { value: "sent", label: t("sent"), content: <SentLots /> },
        ]}
      />
    </div>
  );
}
function IncomingLots() {
  const t = useTranslations("lots");
  const incoming = useQuery(api.traceability.incoming);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="incoming-lots">
      <h2 id="incoming-lots" className="text-lg font-semibold">
        {t("incoming")}
      </h2>
      {incoming ? (
        <>
          {incoming.rows.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y border-y">
              {incoming.rows.map((lot) => (
                <li
                  key={lot.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/lots/${lot.id}`}
                      className="block min-h-11 py-2 font-medium break-words underline underline-offset-4"
                    >
                      {lot.materialCode} · {lot.state}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {t("from", { name: lot.fromName })}
                    </p>
                  </div>
                  <Mass grams={lot.grams} />
                </li>
              ))}
            </ul>
          )}
          {incoming.hasMore ? <p>{t("limit")}</p> : null}
        </>
      ) : (
        <ListSkeleton />
      )}
    </section>
  );
}
function HeldLots() {
  const t = useTranslations("lots");
  const costs = useTranslations("recordedCosts");
  const held = useQuery(api.traceability.mine);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="held-lots">
      <h2 id="held-lots" className="text-lg font-semibold">
        {t("held")}
      </h2>
      {held ? (
        <>
          {held.rows.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y border-y">
              {held.rows.map((lot) => (
                <li
                  key={lot.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/lots/${lot.id}`}
                      className="block min-h-11 py-2 font-medium break-words underline underline-offset-4"
                    >
                      {lot.materialCode} · {lot.state}
                    </Link>
                    <Badge variant="secondary">{t(lot.status)}</Badge>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t(`streams.${lot.streamClass}`)} ·{" "}
                      {t(`handling.${lot.handlingClass}`)}
                    </p>
                  </div>
                  <div className="space-y-1 text-end">
                    <Mass grams={lot.availableGrams} />
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        {costs("remaining")}:{" "}
                      </span>
                      <RecordedCost paise={lot.costPaise} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {held.hasMore ? <p>{t("limit")}</p> : null}
        </>
      ) : (
        <ListSkeleton />
      )}
    </section>
  );
}
function SentLots() {
  const t = useTranslations("lots");
  const format = useFormatter();
  const sent = useQuery(api.traceability.sent);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="sent-lots">
      <h2 id="sent-lots" className="text-lg font-semibold">
        {t("sent")}
      </h2>
      {sent ? (
        <>
          {sent.rows.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y border-y">
              {sent.rows.map((event) => (
                <li key={event.id} className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <span className="font-medium break-words">
                      {event.materialCode} · {event.state}
                    </span>
                    <Mass grams={event.grams} />
                  </div>
                  <p>
                    {t(event.kind)} · {t("to", { name: event.toName })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format.dateTime(event.createdAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {sent.hasMore ? <p>{t("limit")}</p> : null}
        </>
      ) : (
        <ListSkeleton />
      )}
    </section>
  );
}
export function LotDetailPage({ lotId }: { lotId: Id<"materialLots"> }) {
  return (
    <LotAccess>
      <LotDetail lotId={lotId} />
    </LotAccess>
  );
}
function LotDetail({ lotId }: { lotId: Id<"materialLots"> }) {
  const t = useTranslations("lots");
  const costs = useTranslations("recordedCosts");
  const format = useFormatter();
  const business = useBusiness();
  const canOperate = useCanOperate();
  const history = useQuery(api.traceability.history, { lotId });
  if (history === undefined || !business) return <ListSkeleton />;
  const { lot } = history;
  const isHolder = history.access === "holder";
  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="link" className="min-h-11 w-fit px-0">
        <Link href="/app/lots">{t("back")}</Link>
      </Button>
      <AppPageHeader
        title={t("detail")}
        lead={`${lot.materialCode} · ${lot.state}`}
      />
      <p className="max-w-3xl text-sm text-muted-foreground">
        {t("evidenceNote")}
      </p>
      {canOperate ? null : <p>{t("readOnly")}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">{t(lot.status)}</Badge>
        {isHolder ? <HeldLotActions lot={lot} city={business.city} /> : null}
        <AcquisitionCostAction lot={lot} isHolder={isHolder} />
        {isHolder ? null : (
          <ReceiveLot lotId={lot.id} grams={lot.availableGrams} />
        )}
      </div>
      {isHolder ? null : (
        <p className="border-s-2 ps-4 text-sm">{t("pendingNote")}</p>
      )}
      {requiresControlledRoute(lot) ? (
        <p className="border-s-2 ps-4 text-sm">{t("controlledBlocked")}</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">{t("streamClass")}</dt>
          <dd>{t(`streams.${lot.streamClass}`)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("handlingClass")}
          </dt>
          <dd>{t(`handling.${lot.handlingClass}`)}</dd>
        </div>
        {lot.initialGrams === undefined ? null : (
          <div>
            <dt className="text-sm text-muted-foreground">{t("initial")}</dt>
            <dd className="mt-1 text-xl">
              <Mass grams={lot.initialGrams} />
            </dd>
          </div>
        )}
        <div>
          <dt className="text-sm text-muted-foreground">{t("remaining")}</dt>
          <dd className="mt-1 text-xl">
            <Mass grams={lot.availableGrams} />
          </dd>
        </div>
        {isHolder ? (
          <div>
            <dt className="text-sm text-muted-foreground">
              {costs("remaining")}
            </dt>
            <dd className="mt-1 text-xl">
              <RecordedCost paise={lot.costPaise} />
            </dd>
          </div>
        ) : null}
        {lot.sourceKind ? (
          <div>
            <dt className="text-sm text-muted-foreground">{t("source")}</dt>
            <dd className="mt-1">
              {t(
                lot.sourceKind === "self_declared"
                  ? "selfDeclared"
                  : "transformed",
              )}
            </dd>
          </div>
        ) : null}
      </dl>
      {lot.sourceReference ? (
        <p className="text-sm break-words">
          {t("sourceReference")}: {lot.sourceReference}
        </p>
      ) : null}
      <section
        className="flex flex-col gap-3 border-t pt-4"
        aria-labelledby="custody-history"
      >
        <h2 id="custody-history" className="text-lg font-semibold">
          {t("custody")}
        </h2>
        {history.custody.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <ol className="divide-y">
            {history.custody.map((event) => (
              <li key={event.id} className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <span className="font-medium">{t(event.kind)}</span>
                  <Mass grams={event.grams} />
                </div>
                <p className="break-words">
                  {t("handoff", { from: event.fromName, to: event.toName })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(event.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
        {history.hasMoreCustody ? <p>{t("limit")}</p> : null}
      </section>
      {isHolder ? (
        <>
          <Transformations history={history} />
          <Dispositions history={history} />
          <Inspections lotId={lot.id} city={business.city} />
        </>
      ) : null}
    </div>
  );
}

function AcquisitionCostAction({
  lot,
  isHolder,
}: {
  lot: FunctionReturnType<typeof api.traceability.history>["lot"];
  isHolder: boolean;
}) {
  return isHolder && lot.canRecordAcquisitionCost ? (
    <RecordAcquisitionCost lotId={lot.id} />
  ) : null;
}

function Transformations({
  history,
}: {
  history: FunctionReturnType<typeof api.traceability.history>;
}) {
  const t = useTranslations("lots");
  const format = useFormatter();
  const facility = useTranslations("facility");
  return (
    <section
      className="flex flex-col gap-3 border-t pt-4"
      aria-labelledby="lot-transformations"
    >
      <h2 id="lot-transformations" className="text-lg font-semibold">
        {t("transformations")}
      </h2>
      {history.transformations.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ol className="divide-y">
          {history.transformations.map((event) => (
            <li key={event.id} className="flex flex-col gap-3 py-4">
              <p className="text-sm text-muted-foreground">
                {format.dateTime(event.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {event.processKind ? (
                <p className="text-sm break-words">
                  {event.facilityName} ·{" "}
                  {facility(`processKinds.${event.processKind}`)}
                </p>
              ) : null}
              <ProcessingCostSummary {...event} />
              <section aria-label={t("inputs")} className="space-y-2">
                <h3 className="font-medium">{t("inputs")}</h3>
                <ul>
                  {event.inputs.map((input) => (
                    <li
                      key={input.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span className="min-w-0 flex-1 break-words">
                        {input.canOpen ? (
                          <Link
                            href={`/app/lots/${input.id}`}
                            className="block min-h-11 py-2 underline underline-offset-4"
                          >
                            {input.materialCode} · {input.state}
                          </Link>
                        ) : (
                          <>
                            {input.materialCode} · {input.state}
                          </>
                        )}
                      </span>
                      <Mass grams={input.grams} />
                    </li>
                  ))}
                </ul>
              </section>
              <dl className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["inputMass", event.inputGrams],
                    ["contamination", event.contaminationGrams],
                    ["processLoss", event.processLossGrams],
                  ] as const
                ).map(([key, grams]) => (
                  <div key={key}>
                    <dt className="text-sm text-muted-foreground">{t(key)}</dt>
                    <dd>
                      <Mass grams={grams} />
                    </dd>
                  </div>
                ))}
              </dl>
              <ul>
                {event.outputs.map((output) => (
                  <li
                    key={output.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t py-3"
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {output.canOpen ? (
                        <Link
                          href={`/app/lots/${output.id}`}
                          className="block min-h-11 py-2 underline underline-offset-4"
                        >
                          {output.materialCode} · {output.state}
                        </Link>
                      ) : (
                        <>
                          {output.materialCode} · {output.state}
                        </>
                      )}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {t(`streams.${output.streamClass}`)} ·{" "}
                      {t(`handling.${output.handlingClass}`)}
                    </p>
                    <Mass grams={output.grams} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {history.hasMoreTransformations ? <p>{t("limit")}</p> : null}
    </section>
  );
}

function Dispositions({
  history,
}: {
  history: FunctionReturnType<typeof api.traceability.history>;
}) {
  const t = useTranslations("lots");
  const format = useFormatter();
  if (history.dispositions.length === 0) return null;
  return (
    <section
      aria-labelledby="lot-dispositions"
      className="flex flex-col gap-3 border-t pt-4"
    >
      <h2 id="lot-dispositions" className="text-lg font-semibold">
        {t("dispositions")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("dispositionHint")}</p>
      <ol className="divide-y">
        {history.dispositions.map((row) => (
          <li key={row.id} className="space-y-3 py-4">
            <div className="flex flex-wrap justify-between gap-3">
              <Mass grams={row.grams} />
              <span className="text-sm text-muted-foreground">
                {format.dateTime(row.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  "destinationReference",
                  "authorisationReference",
                  "manifestReference",
                ] as const
              ).map((key) => (
                <div key={key} className="min-w-0">
                  <dt className="text-sm text-muted-foreground">{t(key)}</dt>
                  <dd className="break-words">{row[key]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
      {history.hasMoreDispositions ? <p>{t("limit")}</p> : null}
    </section>
  );
}

function HeldLotActions({
  lot,
  city,
}: {
  lot: FunctionReturnType<typeof api.traceability.history>["lot"];
  city: string;
}) {
  const t = useTranslations("lots");
  if (lot.status !== "available") return null;
  if (lot.qualityReleased === false)
    return (
      <p className="text-sm text-muted-foreground">
        {t("qualityReleaseRequired")}
      </p>
    );
  if (requiresControlledRoute(lot))
    return (
      <RecordDisposition
        lotId={lot.id}
        availableGrams={lot.availableGrams}
        materialCode={lot.materialCode}
      />
    );
  return (
    <>
      <TransformLot lotId={lot.id} availableGrams={lot.availableGrams} />
      <DispatchLot lotId={lot.id} grams={lot.availableGrams} city={city} />
    </>
  );
}
