"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

import { ListSkeleton } from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCanOperate } from "@/components/workspace/permissions";
import { isLocale, localeDirection } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  BusinessPicker,
  EvidenceDialog,
  FormStatus,
  LotField,
  useEvidenceAction,
} from "./form-parts";
import { formIndex, inspectionSchema } from "./logic";

type Inspection = FunctionReturnType<typeof api.quality.forLot>["rows"][number];
function inspectionStatus(row: Inspection) {
  if (row.isSuperseded) return "superseded";
  if (!row.supersedesInspectionId) return "original";
  return row.approvedByProfileId ? "approved" : "pendingApproval";
}
export function InspectionForm({
  lotId,
  city,
  previous,
}: {
  lotId: Id<"materialLots">;
  city: string;
  previous?: Inspection;
}) {
  const t = useTranslations("lots");
  const locale = useLocale();
  const canOperate = useCanOperate();
  const record = useMutation(api.quality.recordInspection);
  const correct = useMutation(api.quality.proposeCorrection);
  const [open, setOpen] = useState(false);
  const [withBuyer, setWithBuyer] = useState(false);
  const [buyer, setBuyer] = useState<Id<"orgs">>();
  const action = useEvidenceAction();
  const buyerId = useId();
  const decisionId = useId();
  const form = useForm<
    z.input<typeof inspectionSchema>,
    unknown,
    z.output<typeof inspectionSchema>
  >({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      specificationReference: previous?.specificationReference ?? "",
      specificationVersion: previous?.specificationVersion ?? "",
      sampleMethod: previous?.sampleMethod ?? "",
      results: previous?.results ?? [{ parameter: "", unit: "", value: "" }],
      decision: previous?.decision ?? "",
      evidenceReference: previous?.evidenceReference ?? "",
      reason: "",
    },
  });
  const results = useFieldArray({ control: form.control, name: "results" });
  if (!canOperate || (previous && !previous.canCorrect)) return null;
  return (
    <EvidenceDialog
      title={t(previous ? "correct" : "inspection")}
      hint={t(previous ? "correctionHint" : "inspectionNote")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          void form.handleSubmit(async (values) => {
            if (
              (previous && !values.reason.trim()) ||
              (!previous && withBuyer && !buyer)
            ) {
              action.setFailure("invalidInput");
              return;
            }
            const selectedBuyer = withBuyer ? buyer : undefined;
            const fields = {
              lotId,
              buyerOrgId: previous ? previous.buyerOrgId : selectedBuyer,
              specificationReference: values.specificationReference,
              specificationVersion: values.specificationVersion,
              sampleMethod: values.sampleMethod,
              results: values.results,
              decision: values.decision,
              evidenceReference: values.evidenceReference || undefined,
            };
            await action.run(
              () =>
                previous
                  ? correct({
                      ...fields,
                      supersedesInspectionId: previous.id,
                      reason: values.reason,
                    })
                  : record(fields),
              () => {
                setOpen(false);
                form.reset();
                setWithBuyer(false);
                setBuyer(undefined);
              },
            );
          })(event);
        }}
      >
        <fieldset
          disabled={form.formState.isSubmitting}
          className="flex flex-col gap-4"
        >
          {previous ? (
            <p className="text-sm">
              {t("buyer")}: {previous.buyerName ?? t("noBuyer")}
            </p>
          ) : (
            <>
              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={buyerId}
                  checked={withBuyer}
                  onCheckedChange={(checked) => {
                    setWithBuyer(checked === true);
                    setBuyer(undefined);
                  }}
                />
                <label htmlFor={buyerId}>{t("addBuyer")}</label>
              </div>
              {withBuyer ? (
                <BusinessPicker
                  city={city}
                  value={buyer}
                  onChange={setBuyer}
                  label={t("buyer")}
                />
              ) : null}
            </>
          )}
          <LotField
            label={t("specification")}
            maxLength={120}
            readOnly={Boolean(previous)}
            registration={form.register("specificationReference")}
            invalid={Boolean(form.formState.errors.specificationReference)}
          />
          <LotField
            label={t("version")}
            maxLength={120}
            readOnly={Boolean(previous)}
            registration={form.register("specificationVersion")}
            invalid={Boolean(form.formState.errors.specificationVersion)}
          />
          <LotField
            label={t("sampleMethod")}
            maxLength={120}
            registration={form.register("sampleMethod")}
            invalid={Boolean(form.formState.errors.sampleMethod)}
          />
          <h3 className="font-medium">{t("results")}</h3>
          {results.fields.map((field, index) => (
            <fieldset
              key={field.id}
              className="flex flex-col gap-3 border-t pt-4"
            >
              <legend className="font-medium">
                {t("resultNumber", { number: index + 1 })}
              </legend>
              <LotField
                label={t("parameter")}
                maxLength={120}
                registration={form.register(
                  `results.${formIndex(index)}.parameter`,
                )}
                invalid={Boolean(
                  form.formState.errors.results?.[index]?.parameter,
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <LotField
                  label={t("unit")}
                  maxLength={120}
                  registration={form.register(
                    `results.${formIndex(index)}.unit`,
                  )}
                  invalid={Boolean(
                    form.formState.errors.results?.[index]?.unit,
                  )}
                />
                <LotField
                  label={t("value")}
                  maxLength={120}
                  registration={form.register(
                    `results.${formIndex(index)}.value`,
                  )}
                  invalid={Boolean(
                    form.formState.errors.results?.[index]?.value,
                  )}
                />
              </div>
              {results.fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-fit"
                  onClick={() => {
                    results.remove(index);
                  }}
                >
                  {t("remove")}
                </Button>
              ) : null}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit"
            disabled={results.fields.length >= 30}
            onClick={() => {
              results.append({ parameter: "", unit: "", value: "" });
            }}
          >
            {t("addResult")}
          </Button>
          <label htmlFor={decisionId} className="font-medium">
            {t("decision")}
          </label>
          <Controller
            name="decision"
            control={form.control}
            render={({ field }) => (
              <Select
                dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger id={decisionId} className="min-h-11 w-full">
                  <SelectValue placeholder={t("decision")} />
                </SelectTrigger>
                <SelectContent>
                  {(["accepted", "rejected", "conditional"] as const).map(
                    (decision) => (
                      <SelectItem key={decision} value={decision}>
                        {t(decision)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          />
          <LotField
            label={t("evidenceReference")}
            maxLength={500}
            registration={form.register("evidenceReference")}
            invalid={Boolean(form.formState.errors.evidenceReference)}
          />
          {previous ? (
            <LotField
              label={t("reason")}
              maxLength={120}
              registration={form.register("reason")}
            />
          ) : null}
          <FormStatus
            busy={form.formState.isSubmitting}
            invalid={Object.keys(form.formState.errors).length > 0}
            failure={action.failure}
          />
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}

function ApproveCorrection({ inspection }: { inspection: Inspection }) {
  const t = useTranslations("lots");
  const canOperate = useCanOperate();
  const approve = useMutation(api.quality.approveCorrection);
  const action = useEvidenceAction();
  const [busy, setBusy] = useState(false);
  if (!canOperate || !inspection.canApprove) return null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="min-h-11 w-fit"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void action
            .run(() => approve({ inspectionId: inspection.id }))
            .finally(() => {
              setBusy(false);
            });
        }}
      >
        {t(busy ? "saving" : "approve")}
      </Button>
      {action.failure ? (
        <p role="alert" className="text-sm text-destructive">
          {t(action.failure)}
        </p>
      ) : null}
    </div>
  );
}

/** Mounted only for the current holder; pending receivers never call quality.forLot. */
export function Inspections({
  lotId,
  city,
}: {
  lotId: Id<"materialLots">;
  city: string;
}) {
  const t = useTranslations("lots");
  const format = useFormatter();
  const files = useTranslations("qualityDocuments");
  const reports = useTranslations("auditReports");
  const data = useQuery(api.quality.forLot, { lotId });
  return (
    <section
      className="flex flex-col gap-4 border-t pt-4"
      aria-labelledby="lot-inspections"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lot-inspections" className="text-lg font-semibold">
          {t("inspections")}
        </h2>
        <InspectionForm lotId={lotId} city={city} />
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        {t("inspectionNote")}
      </p>
      {data === undefined ? (
        <ListSkeleton />
      ) : (
        <>
          {data.rows.length === 0 ? (
            <p>{t("empty")}</p>
          ) : (
            <ol className="divide-y border-y">
              {data.rows.map((row) => (
                <li
                  key={row.id}
                  id={`inspection-${row.id}`}
                  className="flex flex-col gap-3 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold break-words">
                      {row.specificationReference} · {row.specificationVersion}
                    </h3>
                    <span className="text-sm">
                      {format.dateTime(row.createdAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {t(inspectionStatus(row))}
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t("decision")}
                      </dt>
                      <dd>{t(row.decision)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t("sampleMethod")}
                      </dt>
                      <dd className="break-words">{row.sampleMethod}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t("buyer")}
                      </dt>
                      <dd>{row.buyerName ?? t("noBuyer")}</dd>
                    </div>
                  </dl>
                  <p className="text-sm">
                    {t("recordedBy", { name: row.orgName })}
                  </p>
                  <ul className="divide-y">
                    {row.results.map((result, index) => (
                      <li
                        key={index}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 py-2"
                      >
                        <span className="break-words">{result.parameter}</span>
                        <span className="text-end break-words">
                          {result.value} {result.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {row.evidenceReference ? (
                    <p className="text-sm break-words">
                      {t("evidenceReference")}: {row.evidenceReference}
                    </p>
                  ) : null}
                  {row.correctionReason ? (
                    <p className="text-sm break-words">
                      {t("reason")}: {row.correctionReason}
                    </p>
                  ) : null}
                  {row.supersedesInspectionId &&
                  data.rows.some(
                    (previous) => previous.id === row.supersedesInspectionId,
                  ) ? (
                    <a
                      href={`#inspection-${row.supersedesInspectionId}`}
                      className="min-h-11 w-fit py-2 text-sm underline underline-offset-4"
                    >
                      {t("previousResult")}
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={{
                        pathname: "/app/quality-documents",
                        query: { inspection: row.id },
                      }}
                      className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-primary underline underline-offset-4"
                    >
                      {files("title")}
                    </Link>
                    <Link
                      href={{
                        pathname: "/account/reports",
                        query: { inspection: row.id },
                      }}
                      className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-primary underline underline-offset-4"
                    >
                      {reports("title")}
                    </Link>
                    <InspectionForm lotId={lotId} city={city} previous={row} />
                    <ApproveCorrection inspection={row} />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {data.hasMore ? (
            <p role="status" className="text-sm">
              {t("limit")}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
