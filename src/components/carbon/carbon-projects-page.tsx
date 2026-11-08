"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type SubmitEvent, useId, useState } from "react";
import { toast } from "sonner";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { useWorkspace } from "@/components/app/use-workspace";
import { QueryBoundary } from "@/components/insights/query-boundary";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, localeDirection } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { hasWorkspacePermission } from "../../../convex/lib/workspaceRoles";

const methods = {
  verra_vmr0007: "Verra VMR0007",
  bee_wa03_003: "BEE BM WA03.003",
  bee_in02_001: "BEE BM IN02.001",
  verra_vmr0008: "Verra VMR0008",
} as const;

const requiredEvidence = [
  "baseline",
  "monitoring",
  "claim_rights",
  "verification_report",
] as const;
const evidenceKinds = [
  ...requiredEvidence,
  "registry_project",
  "registry_issuance",
  "registry_transfer",
  "registry_retirement",
] as const;

type Project = FunctionReturnType<
  typeof api.carbonProjects.mine
>["rows"][number];

export function CarbonProjectsPage() {
  const t = useTranslations("carbonProjects");
  const evidence = useTranslations("evidence");
  const workspaceText = useTranslations("workspace");
  const workspace = useWorkspace();
  let content;
  if (workspace === undefined) content = <ListSkeleton />;
  else if (workspace?.kind === "org") {
    content = (
      <QueryBoundary key={workspace.org.id}>
        <Projects
          orgId={workspace.org.id}
          canOperate={hasWorkspacePermission(workspace.role, "operate")}
          canReview={hasWorkspacePermission(workspace.role, "manage")}
        />
      </QueryBoundary>
    );
  } else content = <p>{workspaceText("empty")}</p>;

  return (
    <div className="flex flex-col gap-6">
      <AppPageHeader title={t("title")} lead={evidence("lead")} />
      {content}
    </div>
  );
}

function Projects({
  orgId,
  canOperate,
  canReview,
}: {
  orgId: Id<"orgs">;
  canOperate: boolean;
  canReview: boolean;
}) {
  const rows = useQuery(api.carbonProjects.mine, { expectedOrgId: orgId });
  const lots = useTranslations("lots");
  const evidence = useTranslations("evidence");
  const operations = useTranslations("operations");
  const [openBatchProject, setOpenBatchProject] =
    useState<Id<"carbonProjects"> | null>(null);
  if (!rows) return <ListSkeleton />;
  return (
    <>
      {canOperate ? <CreateProject orgId={orgId} /> : <p>{lots("readOnly")}</p>}
      {rows.rows.length === 0 ? (
        <p>{lots("empty")}</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {rows.rows.map((project) => (
            <li key={project.id} className="space-y-4 py-4">
              <ProjectSummary project={project} />
              <Button
                type="button"
                variant="outline"
                aria-expanded={openBatchProject === project.id}
                onClick={() => {
                  setOpenBatchProject(
                    openBatchProject === project.id ? null : project.id,
                  );
                }}
              >
                {operations("batches")}
              </Button>
              {openBatchProject === project.id ? (
                <ProjectBatches
                  orgId={orgId}
                  project={project}
                  canOperate={canOperate}
                />
              ) : null}
              {canOperate ? (
                <ProjectActions
                  orgId={orgId}
                  project={project}
                  canReview={canReview}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {rows.hasMore ? <p>{evidence("export.partial")}</p> : null}
    </>
  );
}

function ProjectSummary({ project }: { project: Project }) {
  const t = useTranslations("carbonProjects");
  const evidence = useTranslations("evidence");
  return (
    <>
      <h2 className="text-lg font-semibold break-words">{project.name}</h2>
      <p className="text-sm break-words">
        {project.facilityName} · {methods[project.method]}
      </p>
      <p className="text-sm text-muted-foreground">
        {t(project.status === "draft" ? "draft" : "reviewed")} ·{" "}
        {evidence("unverified")}
      </p>
      <dl className="space-y-2">
        {project.evidence.map((entry) => (
          <div
            key={entry.kind}
            className="flex flex-wrap gap-x-3 gap-y-1 text-sm"
          >
            <dt className="font-medium">{t(`kinds.${entry.kind}`)}</dt>
            <dd className="min-w-0 break-all">{entry.reference}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function ProjectBatches({
  orgId,
  project,
  canOperate,
}: {
  orgId: Id<"orgs">;
  project: Project;
  canOperate: boolean;
}) {
  const args = { expectedOrgId: orgId, projectId: project.id };
  const attached = useQuery(api.carbonProjects.batches, args);
  const options = useQuery(
    api.carbonProjects.batchOptions,
    canOperate ? args : "skip",
  );
  const attach = useMutation(api.carbonProjects.attachBatch);
  const detach = useMutation(api.carbonProjects.detachBatch);
  const evidence = useTranslations("evidence");
  const operations = useTranslations("operations");
  const lots = useTranslations("lots");
  const common = useTranslations("common");
  const format = useFormatter();
  const id = useId();
  const [isBusy, setIsBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  function describe(row: {
    recordedAt: number;
    inputGrams: number;
    transformationId: string;
  }) {
    return [
      format.dateTime(row.recordedAt, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      lots("grams", { value: format.number(row.inputGrams) }),
      row.transformationId.slice(-8),
    ].join(" · ");
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("transformation");
    const row = options?.rows.find(
      ({ transformationId }) => transformationId === value,
    );
    if (row) await changeBatch(attach, row.transformationId);
  }

  async function changeBatch(
    action: typeof attach,
    transformationId: Id<"lotTransformations">,
  ) {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await action({
        ...args,
        transformationId,
        expectedRevision: project.revision,
      });
      setFormVersion((version) => version + 1);
      toast.success(operations("saved"));
    } catch {
      toast.error(common("error"));
    } finally {
      setIsBusy(false);
    }
  }

  if (!attached) return <ListSkeleton rows={1} />;
  return (
    <section className="max-w-xl space-y-3">
      <h3 className="font-medium">{operations("batches")}</h3>
      {attached.rows.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {attached.rows.map((row) => (
            <li
              key={row.transformationId}
              className="flex flex-wrap items-center gap-2"
            >
              <span>{describe(row)}</span>
              {canOperate ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  aria-label={`${operations("remove")} · ${describe(row)}`}
                  onClick={() => {
                    void changeBatch(detach, row.transformationId);
                  }}
                >
                  {operations("remove")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{lots("empty")}</p>
      )}
      {options && options.rows.length > 0 ? (
        <form
          key={formVersion}
          className="space-y-3"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <Choice
            id={id}
            name="transformation"
            label={operations("transformation")}
            options={options.rows.map((row) => ({
              value: row.transformationId,
              label: describe(row),
            }))}
          />
          <ActionButton
            type="submit"
            label={operations("save")}
            isDisabled={isBusy}
          />
        </form>
      ) : null}
      {attached.hasMore || options?.hasMore ? (
        <p>{evidence("export.partial")}</p>
      ) : null}
    </section>
  );
}

function Choice({
  id,
  name,
  label,
  options,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  const locale = useLocale();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        name={name}
        required
        dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
      >
        <SelectTrigger id={id} className="min-h-11 w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CreateProject({ orgId }: { orgId: Id<"orgs"> }) {
  const facilities = useQuery(api.industrialProfiles.mine, {});
  const create = useMutation(api.carbonProjects.create);
  const t = useTranslations("carbonProjects");
  const facility = useTranslations("facility");
  const lots = useTranslations("lots");
  const production = useTranslations("operations");
  const common = useTranslations("common");
  const id = useId();
  const [isBusy, setIsBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name");
    const site = facilities?.find((item) => item._id === form.get("facility"));
    const method = (Object.keys(methods) as (keyof typeof methods)[]).find(
      (value) => value === form.get("method"),
    );
    if (isBusy || !site || !method || typeof name !== "string" || !name.trim())
      return;
    setIsBusy(true);
    try {
      await create({
        expectedOrgId: orgId,
        facilityId: site._id,
        name: name.trim(),
        method,
      });
      setFormVersion((version) => version + 1);
      toast.success(production("saved"));
    } catch {
      toast.error(common("error"));
    } finally {
      setIsBusy(false);
    }
  }

  if (facilities === undefined) return <ListSkeleton rows={1} />;
  if (facilities.length === 0)
    return (
      <Button asChild variant="outline">
        <Link href="/app/facility">{facility("title")}</Link>
      </Button>
    );
  return (
    <form
      key={formVersion}
      onSubmit={(event) => {
        void submit(event);
      }}
      className="max-w-xl space-y-4 border-t border-border pt-4"
    >
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>{t("name")}</Label>
        <Input id={`${id}-name`} name="name" maxLength={120} required />
      </div>
      <Choice
        id={`${id}-facility`}
        name="facility"
        label={lots("facility")}
        options={facilities.map((site) => ({
          value: site._id,
          label: site.name,
        }))}
      />
      <Choice
        id={`${id}-method`}
        name="method"
        label={t("method")}
        options={Object.entries(methods).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <ActionButton
        type="submit"
        label={production("save")}
        isDisabled={isBusy}
      />
    </form>
  );
}

function ProjectActions({
  orgId,
  project,
  canReview,
}: {
  orgId: Id<"orgs">;
  project: Project;
  canReview: boolean;
}) {
  const t = useTranslations("carbonProjects");
  const evidence = useTranslations("evidence");
  const production = useTranslations("operations");
  const common = useTranslations("common");
  const record = useMutation(api.carbonProjects.recordEvidence);
  const review = useMutation(api.carbonProjects.review);
  const id = useId();
  const [isBusy, setIsBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const args = {
    expectedOrgId: orgId,
    projectId: project.id,
    expectedRevision: project.revision,
  };
  const canMarkReviewed =
    canReview &&
    project.status === "draft" &&
    requiredEvidence.every((kind) =>
      project.evidence.some((entry) => entry.kind === kind),
    );

  async function save(action: () => Promise<null>) {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await action();
      setFormVersion((version) => version + 1);
      toast.success(production("saved"));
    } catch {
      toast.error(common("error"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <form
        key={formVersion}
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const kind = evidenceKinds.find(
            (value) => value === form.get("kind"),
          );
          const reference = form.get("reference");
          if (typeof reference === "string" && kind && reference.trim())
            void save(() =>
              record({ ...args, kind, reference: reference.trim() }),
            );
        }}
      >
        <Choice
          id={`${id}-kind`}
          name="kind"
          label={evidence("kind")}
          options={evidenceKinds.map((kind) => ({
            value: kind,
            label: t(`kinds.${kind}`),
          }))}
        />
        <div className="space-y-2">
          <Label htmlFor={`${id}-reference`}>{evidence("reference")}</Label>
          <Input
            id={`${id}-reference`}
            name="reference"
            aria-describedby={`${id}-reference-hint`}
            maxLength={160}
            required
          />
          <p
            id={`${id}-reference-hint`}
            className="text-sm text-muted-foreground"
          >
            {t("referenceHint")}
          </p>
        </div>
        <ActionButton
          type="submit"
          label={evidence("record")}
          isDisabled={isBusy}
        />
      </form>
      {canMarkReviewed ? (
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={() => {
            void save(() => review(args));
          }}
        >
          {t("review")}
        </Button>
      ) : null}
    </div>
  );
}
