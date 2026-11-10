import { useMutation, useQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { type SubmitEvent, useId, useState } from "react";
import { toast } from "sonner";

import { ListSkeleton } from "@/components/app/page-parts";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type CarbonFrameworkId,
  carbonFrameworkIds,
  carbonFrameworks,
  type CarbonGateId,
  carbonGatesForProject,
  carbonGateStates,
  carbonIndustries,
  type CarbonIndustryId,
} from "@/lib/carbon-frameworks";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Choice } from "./choice";

interface FrameworkDraft {
  revision: number;
  gate?: CarbonGateId;
  status?: (typeof carbonGateStates)[number];
  reference?: string;
}

export function FrameworkScreening({
  orgId,
  projectId,
  industry,
  canOperate,
  isOpen,
}: {
  orgId: Id<"orgs">;
  projectId: Id<"carbonProjects">;
  industry?: CarbonIndustryId;
  canOperate: boolean;
  isOpen: boolean;
}) {
  const args = isOpen ? { expectedOrgId: orgId, projectId } : "skip";
  const records = useQuery(api.carbonProjects.frameworkScreenings, args);
  const t = useTranslations("carbonProjects.screening");
  const id = useId();
  const [selection, setSelection] = useState<CarbonFrameworkId>();
  const [isSaving, setIsSaving] = useState(false);
  const [drafts, setDrafts] = useState<
    Partial<Record<CarbonFrameworkId, FrameworkDraft>>
  >({});
  if (!isOpen) return null;

  const candidate = industry ? carbonIndustries[industry] : undefined;
  const framework = selection ?? candidate?.framework ?? carbonFrameworkIds[0];
  const definition = carbonFrameworks[framework];
  const gates = carbonGatesForProject(framework, industry);
  const source =
    candidate?.framework === framework ? candidate.source : definition.source;
  const record = records?.find((entry) => entry.framework === framework);

  return (
    <section
      className="max-w-2xl space-y-4 border-y border-border py-4"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`} className="font-medium">
        {t("title")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("notice")}</p>
      <Choice
        id={`${id}-framework`}
        name="framework"
        label={t("framework")}
        options={carbonFrameworkIds.map((value) => ({
          value,
          label: carbonFrameworks[value].name,
        }))}
        value={framework}
        disabled={isSaving}
        onValueChange={(value) => {
          const selected = carbonFrameworkIds.find((entry) => entry === value);
          if (selected) setSelection(selected);
        }}
      />
      <p className="text-sm">
        <span className="font-medium">{t("petExample")}</span>{" "}
        {t(`fit.${definition.petFit}`)}
      </p>
      <div className="flex flex-wrap gap-x-4">
        <a
          href={source}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
        >
          {t("source")}
        </a>
        <a
          href={definition.lifecycleSource}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
        >
          {t("process")}
        </a>
      </div>
      {records === undefined ? (
        <ListSkeleton rows={1} />
      ) : (
        <>
          {canOperate ? (
            <FrameworkCheckForm
              key={framework}
              orgId={orgId}
              projectId={projectId}
              framework={framework}
              gates={gates}
              revision={record?.revision ?? 0}
              draft={drafts[framework]}
              isBusy={isSaving}
              onBusyChange={setIsSaving}
              onDraftChange={(draft) => {
                setDrafts((previous) => ({ ...previous, [framework]: draft }));
              }}
            />
          ) : null}
          {record ? (
            <FrameworkHistory
              key={`history-${framework}`}
              orgId={orgId}
              projectId={projectId}
              framework={framework}
            />
          ) : null}
          <dl className="divide-y divide-border border-y border-border text-sm">
            {gates.map((gate) => {
              const check = record?.checks.find((entry) => entry.gate === gate);
              return (
                <div
                  key={gate}
                  className="grid gap-1 py-2 sm:grid-cols-2 sm:gap-x-4"
                >
                  <dt className="font-medium">{t(`gates.${gate}`)}</dt>
                  <dd className="min-w-0">
                    <span>{t(`status.${check?.status ?? "missing"}`)}</span>
                    {check ? (
                      <span className="block break-all text-muted-foreground">
                        {check.reference}
                      </span>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
    </section>
  );
}

function FrameworkHistory({
  orgId,
  projectId,
  framework,
}: {
  orgId: Id<"orgs">;
  projectId: Id<"carbonProjects">;
  framework: CarbonFrameworkId;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("carbonProjects.screening");
  const history = useTranslations("logistics");
  const evidence = useTranslations("evidence");
  const format = useFormatter();
  const id = useId();
  const result = useQuery(
    api.carbonProjects.frameworkHistory,
    open ? { expectedOrgId: orgId, projectId, framework } : "skip",
  );

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {history("history")}
      </Button>
      <div id={id} hidden={!open}>
        {open && !result ? <ListSkeleton rows={1} /> : null}
        {open && result ? (
          <>
            {result.historyComplete ? null : (
              <p className="text-sm text-muted-foreground">
                {evidence("export.partial")}
              </p>
            )}
            <ul className="divide-y divide-border text-sm">
              {result.changes.map((change) => (
                <li key={change.revision} className="space-y-1 py-2">
                  <p>
                    {history("revision", { number: change.revision })} ·{" "}
                    <time dateTime={new Date(change.recordedAt).toISOString()}>
                      {format.dateTime(change.recordedAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </p>
                  <p>
                    {t(`gates.${change.gate}`)} · {t(`status.${change.status}`)}
                  </p>
                  <p className="break-all">{change.reference}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

function FrameworkCheckForm({
  orgId,
  projectId,
  framework,
  gates,
  revision,
  draft,
  isBusy,
  onBusyChange,
  onDraftChange,
}: {
  orgId: Id<"orgs">;
  projectId: Id<"carbonProjects">;
  framework: CarbonFrameworkId;
  gates: readonly CarbonGateId[];
  revision: number;
  draft?: FrameworkDraft;
  isBusy: boolean;
  onBusyChange: (isBusy: boolean) => void;
  onDraftChange: (value: FrameworkDraft | undefined) => void;
}) {
  const record = useMutation(api.carbonProjects.recordFrameworkCheck);
  const t = useTranslations("carbonProjects");
  const evidence = useTranslations("evidence");
  const operations = useTranslations("operations");
  const common = useTranslations("common");
  const id = useId();

  function updateDraft(change: Partial<FrameworkDraft>) {
    onDraftChange({ revision, ...draft, ...change });
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const { gate, status, reference } = draft ?? {};
    if (
      isBusy ||
      !gate ||
      !status ||
      draft?.revision !== revision ||
      !reference?.trim()
    )
      return;

    onBusyChange(true);
    try {
      await record({
        expectedOrgId: orgId,
        projectId,
        framework,
        gate,
        status,
        reference: reference.trim(),
        expectedRevision: draft.revision,
      });
      onDraftChange(undefined);
      toast.success(operations("saved"));
    } catch {
      toast.error(common("error"));
    } finally {
      onBusyChange(false);
    }
  }

  const hasConflict = draft !== undefined && draft.revision !== revision;
  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <Choice
        id={`${id}-gate`}
        name="gate"
        label={t("screening.check")}
        options={gates.map((gate) => ({
          value: gate,
          label: t(`screening.gates.${gate}`),
        }))}
        value={draft?.gate ?? ""}
        disabled={isBusy}
        onValueChange={(value) => {
          const gate = gates.find((entry) => entry === value);
          if (gate) updateDraft({ gate });
        }}
      />
      <Choice
        id={`${id}-status`}
        name="status"
        label={t("screening.result")}
        options={carbonGateStates.map((status) => ({
          value: status,
          label: t(`screening.status.${status}`),
        }))}
        value={draft?.status ?? ""}
        disabled={isBusy}
        onValueChange={(value) => {
          const status = carbonGateStates.find((entry) => entry === value);
          if (status) updateDraft({ status });
        }}
      />
      <div className="space-y-2">
        <Label htmlFor={`${id}-reference`}>{evidence("reference")}</Label>
        <Input
          id={`${id}-reference`}
          name="reference"
          aria-describedby={`${id}-reference-hint`}
          maxLength={160}
          value={draft?.reference ?? ""}
          disabled={isBusy}
          onChange={(event) => {
            updateDraft({ reference: event.target.value });
          }}
          required
        />
        <p
          id={`${id}-reference-hint`}
          className="text-sm text-muted-foreground"
        >
          {t("referenceHint")}
        </p>
      </div>
      {hasConflict ? (
        <div className="space-y-2">
          <p role="status" className="text-sm">
            {t("screening.conflict")}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => {
              updateDraft({ revision });
            }}
          >
            {t("screening.useLatest")}
          </Button>
        </div>
      ) : null}
      <ActionButton
        type="submit"
        label={t("screening.save")}
        isDisabled={
          isBusy ||
          hasConflict ||
          !draft?.gate ||
          !draft.status ||
          !draft.reference?.trim()
        }
      />
    </form>
  );
}
