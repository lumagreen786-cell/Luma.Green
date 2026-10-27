"use client";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Suspense, useId, useRef, useState } from "react";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { useBusiness } from "@/components/shop/use-shop";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { QUALITY_MAX_BYTES } from "../../../convex/lib/qualityContent";
import { Choice, Download, useQualityAction } from "./shared";
type Board = FunctionReturnType<typeof api.qualityFiles.board>;
type FileRow = Board["own"][number];
type FileKind = "coa" | "photo" | "sample_report";
type BuyerDecisionKind = "accepted" | "rejected" | "conditional";
function isFileKind(value: string): value is FileKind {
  return ["coa", "photo", "sample_report"].includes(value);
}
function isDecision(value: string): value is BuyerDecisionKind {
  return ["accepted", "rejected", "conditional"].includes(value);
}
export function QualityDocuments() {
  const business = useBusiness();
  const t = useTranslations("qualityDocuments");
  if (business === undefined) return <ListSkeleton />;
  return business ? (
    <Suspense fallback={<ListSkeleton />}>
      <QualityBoard key={business.id} />
    </Suspense>
  ) : (
    <p>{t("businessRequired")}</p>
  );
}
function QualityBoard() {
  const data = useQuery(api.qualityFiles.board, {});
  const t = useTranslations("qualityDocuments");
  const format = useFormatter();
  const requested = useSearchParams().get("inspection");
  const selected = data?.inspections.find((row) => row.id === requested);
  if (!data) return <ListSkeleton />;
  return (
    <div className="flex flex-col gap-6">
      <AppPageHeader title={t("title")} lead={t("lead")} />
      <Link href="/app/lots" className="w-fit underline">
        {t("inspections")}
      </Link>
      {data.canOperate ? null : <p>{t("readOnly")}</p>}
      <WorkflowTabs
        key={selected?.id ?? "all"}
        defaultValue={selected && data.canOperate ? "upload" : undefined}
        items={[
          {
            value: "own",
            label: t("own"),
            content: (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">{t("own")}</h2>
                {data.own.length === 0 ? (
                  <p>{t("empty")}</p>
                ) : (
                  data.own.map((file) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      canWithdraw={data.canWithdraw}
                    />
                  ))
                )}
              </section>
            ),
          },
          {
            value: "incoming",
            label: t("incoming"),
            content: (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">{t("incoming")}</h2>
                {data.incoming.length === 0 ? (
                  <p>{t("empty")}</p>
                ) : (
                  data.incoming.map((file) => (
                    <div className="space-y-4 border-b pb-4" key={file.id}>
                      <FileItem file={file} canWithdraw={false} />
                      {data.canOperate ? <BuyerDecision file={file} /> : null}
                    </div>
                  ))
                )}
              </section>
            ),
          },
          {
            value: "decisions",
            label: t("decisions"),
            content: (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">{t("decisions")}</h2>
                {data.decisions.map((d) => (
                  <div className="border-b pb-3" key={d.id}>
                    <p>
                      {t(d.decision)} ·{" "}
                      {format.dateTime(d.createdAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="break-words">{d.note}</p>
                  </div>
                ))}
              </section>
            ),
          },
          ...(data.canOperate
            ? [
                {
                  value: "upload",
                  label: t("upload"),
                  content: <Upload data={data} inspectionId={selected?.id} />,
                },
              ]
            : []),
        ]}
      />
      <p className="text-sm text-muted-foreground">{t("limit")}</p>
    </div>
  );
}
function Upload({
  data,
  inspectionId,
}: {
  data: Board;
  inspectionId?: string;
}) {
  const t = useTranslations("qualityDocuments");
  const upload = useAction(api.qualityFiles.upload);
  const action = useQualityAction();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [inspection, setInspection] = useState(inspectionId ?? "");
  const [kind, setKind] = useState<"coa" | "photo" | "sample_report">("coa");
  const [file, setFile] = useState<File | null>(null);
  const [share, setShare] = useState(false);
  const selected = data.inspections.find((i) => i.id === inspection);
  return (
    <form
      className="flex max-w-2xl flex-col gap-4 border-t pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(async () => {
          if (!selected || !file || file.size > QUALITY_MAX_BYTES)
            throw new Error("INVALID_FILE");
          await upload({
            inspectionId: selected.id,
            shareWithBuyer: share,
            kind,
            name: file.name,
            contentType: file.type,
            bytes: await file.arrayBuffer(),
          });
          setFile(null);
          if (input.current) input.current.value = "";
        });
      }}
    >
      <h2 className="text-lg font-semibold">{t("upload")}</h2>
      <Choice
        label={t("inspection")}
        value={inspection}
        onChange={(value) => {
          setInspection(value);
          setShare(false);
        }}
        options={data.inspections.map((i) => ({ id: i.id, label: i.label }))}
      />
      <Choice
        label={t("kind")}
        value={kind}
        onChange={(value) => {
          if (isFileKind(value)) setKind(value);
        }}
        options={["coa", "photo", "sample_report"].map((value) => ({
          id: value,
          label: t(value as "coa" | "photo" | "sample_report"),
        }))}
      />
      <Label htmlFor={id}>{t("file")}</Label>
      <Input
        ref={input}
        id={id}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
        }}
      />
      <p className="text-sm text-muted-foreground">{t("fileHint")}</p>
      {selected?.buyerName ? (
        <Label className="flex items-start gap-3">
          <Checkbox
            checked={share}
            onCheckedChange={(value) => {
              setShare(value === true);
            }}
          />
          {t("shareBuyer", { name: selected.buyerName })}
        </Label>
      ) : null}
      <Button
        className="min-h-11 self-start"
        disabled={action.busy || !file || !selected}
      >
        {t("upload")}
      </Button>
      {action.failed ? (
        <p role="alert" className="text-destructive">
          {t("error")}
        </p>
      ) : null}
    </form>
  );
}
function FileItem({
  file,
  canWithdraw,
}: {
  file: FileRow;
  canWithdraw: boolean;
}) {
  const t = useTranslations("qualityDocuments");
  const withdraw = useMutation(api.qualityFiles.withdraw);
  const action = useQualityAction();
  return (
    <div className="flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row">
      <div className="min-w-0">
        <p className="font-medium break-words">{file.name}</p>
        <p className="text-sm text-muted-foreground">
          {t(file.kind)} · {t(file.sharedWithBuyer ? "shared" : "private")}
        </p>
      </div>
      {file.withdrawnAt ? (
        <p>{t("withdrawn")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Download id={file.id} name={file.name} />
          {canWithdraw ? (
            <Button
              variant="outline"
              disabled={action.busy}
              onClick={() => {
                void action.run(async () => {
                  await withdraw({ fileId: file.id });
                });
              }}
            >
              {t("withdraw")}
            </Button>
          ) : null}
        </div>
      )}
      {action.failed ? <p role="alert">{t("error")}</p> : null}
    </div>
  );
}
function BuyerDecision({ file }: { file: FileRow }) {
  const t = useTranslations("qualityDocuments");
  const id = useId();
  const decide = useMutation(api.qualityFiles.decide);
  const action = useQualityAction();
  const [decision, setDecision] = useState<
    "accepted" | "rejected" | "conditional"
  >("conditional");
  const [note, setNote] = useState("");
  return (
    <form
      className="flex max-w-2xl flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(async () => {
          await decide({
            inspectionId: file.inspectionId,
            attachmentIds: [file.id],
            decision,
            note,
          });
          setNote("");
        });
      }}
    >
      <Choice
        label={t("decision")}
        value={decision}
        onChange={(value) => {
          if (isDecision(value)) setDecision(value);
        }}
        options={["accepted", "rejected", "conditional"].map((value) => ({
          id: value,
          label: t(value as "accepted" | "rejected" | "conditional"),
        }))}
      />
      <Label htmlFor={id}>{t("note")}</Label>
      <Textarea
        id={id}
        value={note}
        minLength={3}
        maxLength={500}
        required
        onChange={(e) => {
          setNote(e.target.value);
        }}
      />
      <Button className="min-h-11 self-start" disabled={action.busy}>
        {t("record")}
      </Button>
      {action.failed ? <p role="alert">{t("error")}</p> : null}
    </form>
  );
}
