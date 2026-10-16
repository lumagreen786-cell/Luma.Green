"use client";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { RecordWorkspace } from "@/components/app/record-workspace";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Choice, Download, useQualityAction } from "./shared";
type Board = FunctionReturnType<typeof api.auditShares.board>;
export function AuditReports() {
  const data = useSignedInQuery(api.auditShares.board);
  if (data === undefined) return <ListSkeleton />;
  if (!data) return null;
  return (
    <ReportsContent
      key={`${data.orgId ?? "recipient"}:${String(data.canCreate)}`}
      data={data}
    />
  );
}
function ReportsContent({ data }: { data: Board }) {
  const t = useTranslations("auditReports");
  const [selected, setSelected] = useState<Id<"auditReports"> | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <AppPageHeader title={t("title")} lead={t("lead")} />
      <RecordWorkspace
        detailKey={selected ?? undefined}
        onBack={() => {
          setSelected(null);
        }}
        list={
          <WorkflowTabs
            items={[
              {
                value: "received",
                label: t("received"),
                content: (
                  <ReportList
                    rows={data.received}
                    own={false}
                    onSelect={setSelected}
                  />
                ),
              },
              {
                value: "sent",
                label: t("sent"),
                content: (
                  <ReportList rows={data.own} own onSelect={setSelected} />
                ),
              },
              ...(data.canCreate
                ? [
                    {
                      value: "create",
                      label: t("create"),
                      content: <CreateReport key={data.orgId} data={data} />,
                    },
                  ]
                : []),
            ]}
          />
        }
        detail={
          selected ? (
            <ReportDetail key={selected} reportId={selected} />
          ) : undefined
        }
      />
      <p className="text-sm text-muted-foreground">{t("limit")}</p>
    </div>
  );
}
function CreateReport({ data }: { data: Board }) {
  const t = useTranslations("auditReports");
  const create = useMutation(api.auditShares.create);
  const action = useQualityAction();
  const id = useId();
  const [inspection, setInspection] = useState("");
  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expiry, setExpiry] = useState("");
  const [files, setFiles] = useState<Id<"qualityAttachments">[]>([]);
  return (
    <form
      className="flex max-w-2xl flex-col gap-4 border-t pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(async () => {
          const row = data.inspections.find((i) => i.id === inspection);
          const to = data.recipients.find((i) => i.id === recipient);
          if (!row || !to) throw new Error("INVALID_SCOPE");
          await create({
            inspectionId: row.id,
            recipientId: to.id,
            purpose,
            expiresAt: new Date(expiry).getTime(),
            attachmentIds: files,
          });
          setPurpose("");
          setFiles([]);
        });
      }}
    >
      <h2 className="text-lg font-semibold">{t("create")}</h2>
      <Choice
        label={t("inspection")}
        value={inspection}
        onChange={(value) => {
          setInspection(value);
          setFiles([]);
        }}
        options={data.inspections.map((i) => ({ id: i.id, label: i.label }))}
      />
      <Choice
        label={t("recipient")}
        value={recipient}
        onChange={setRecipient}
        options={data.recipients.map((i) => ({ id: i.id, label: i.name }))}
      />
      <Label htmlFor={`${id}-purpose`}>{t("purpose")}</Label>
      <Textarea
        id={`${id}-purpose`}
        required
        minLength={3}
        maxLength={200}
        value={purpose}
        onChange={(e) => {
          setPurpose(e.target.value);
        }}
      />
      <Label htmlFor={`${id}-expiry`}>{t("expiry")}</Label>
      <Input
        id={`${id}-expiry`}
        type="datetime-local"
        required
        value={expiry}
        onChange={(e) => {
          setExpiry(e.target.value);
        }}
      />
      <p className="text-sm text-muted-foreground">{t("warning")}</p>
      {data.files
        .filter((f) => f.inspectionId === inspection)
        .map((file) => (
          <Label key={file.id} className="flex items-start gap-3">
            <Checkbox
              checked={files.includes(file.id)}
              onCheckedChange={(checked) => {
                setFiles((old) =>
                  checked === true
                    ? [...old, file.id]
                    : old.filter((f) => f !== file.id),
                );
              }}
            />
            {file.name}
          </Label>
        ))}
      <Button
        className="min-h-11 self-start"
        disabled={action.busy || !inspection || !recipient}
      >
        {t("create")}
      </Button>
      {action.failed ? (
        <p role="alert" className="text-destructive">
          {t("error")}
        </p>
      ) : null}
    </form>
  );
}
function ReportList({
  rows,
  own,
  onSelect,
}: {
  rows: Board["own"];
  own: boolean;
  onSelect: (id: Id<"auditReports">) => void;
}) {
  const t = useTranslations("auditReports");
  const format = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const revoke = useMutation(api.auditShares.revoke);
  const action = useQualityAction();
  return (
    <section className="space-y-4 border-t pt-6">
      <h2 className="text-lg font-semibold">{t(own ? "sent" : "received")}</h2>
      {rows.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row"
          >
            <div className="min-w-0">
              <p className="font-medium break-words">{row.purpose}</p>
              <p>
                {format.dateTime(row.expiresAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            {row.revokedAt || row.expiresAt <= now.getTime() ? (
              <p>{t("unavailable")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    onSelect(row.id);
                  }}
                >
                  {t("open")}
                </Button>
                {own ? (
                  <Button
                    variant="outline"
                    disabled={action.busy}
                    onClick={() => {
                      void action.run(async () => {
                        await revoke({ reportId: row.id });
                      });
                    }}
                  >
                    {t("revoke")}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ))
      )}
      {action.failed ? <p role="alert">{t("error")}</p> : null}
    </section>
  );
}
function ReportDetail({ reportId }: { reportId: Id<"auditReports"> }) {
  const t = useTranslations("auditReports");
  const q = useTranslations("qualityDocuments");
  const format = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const report = useQuery(api.auditShares.read, { reportId });
  if (report === undefined) return <ListSkeleton />;
  if (!report || report.expiresAt <= now.getTime())
    return <p role="status">{t("unavailable")}</p>;
  const s = report.snapshot;
  return (
    <section className="space-y-4 border-t pt-6">
      <h2 className="text-lg font-semibold">{report.purpose}</h2>
      <p>{t("snapshot")}</p>
      <p className="break-words">
        {s.materialCode} · {s.state} · {format.number(s.declaredGrams)} g
      </p>
      <p className="break-words">
        {s.specificationReference} · {s.specificationVersion}
      </p>
      <p className="break-words">{s.sampleMethod}</p>
      <ul className="divide-y">
        {s.results.map((result, index) => (
          <li className="flex justify-between gap-4 py-3" key={index}>
            <span className="min-w-0 break-words">{result.parameter}</span>
            <span className="min-w-0 break-words">
              {result.value} {result.unit}
            </span>
          </li>
        ))}
      </ul>
      <p>
        {q(s.inspectingDecision as "accepted" | "rejected" | "conditional")}
      </p>
      <h3 className="font-semibold">{q("decisions")}</h3>
      {s.buyerDecisions.length === 0 ? (
        <p>{q("empty")}</p>
      ) : (
        s.buyerDecisions.map((decision, index) => (
          <div className="border-b py-3" key={index}>
            <p>
              {q(decision.decision as "accepted" | "rejected" | "conditional")}{" "}
              · {format.dateTime(decision.createdAt, { dateStyle: "medium" })}
            </p>
            <p className="break-words">{decision.note}</p>
          </div>
        ))
      )}
      {report.files.map((file) => (
        <div
          key={file.id}
          className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
        >
          <span className="break-words">{file.name}</span>
          {file.available ? (
            <Download id={file.id} name={file.name} reportId={reportId} />
          ) : (
            <span>{t("unavailable")}</span>
          )}
        </div>
      ))}
    </section>
  );
}
