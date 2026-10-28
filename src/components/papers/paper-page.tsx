"use client";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { FileTextIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { NotForYou } from "@/components/shop/guards";
import { useBusiness } from "@/components/shop/use-shop";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { hasPaperContent, type PaperContent } from "../../../convex/lib/paper";

type Paper = FunctionReturnType<typeof api.paperDrafts.get>;
const fieldNames = {
  dateText: "date",
  description: "description",
  quantityText: "quantity",
  unitText: "unit",
  amountText: "amount",
  referenceText: "reference",
} as const;
const emptyRow = {
  dateText: "",
  description: "",
  quantityText: "",
  unitText: "",
  amountText: "",
  referenceText: "",
};
export function PaperPage() {
  const business = useBusiness();
  const t = useTranslations("papers");
  const workspace = useTranslations("workspace");
  if (business === undefined) return <ListSkeleton />;
  if (!business)
    return (
      <NotForYou
        title={t("title")}
        heading={t("title")}
        body={workspace("empty")}
        icon={FileTextIcon}
      />
    );
  return <PaperBoard key={business.id} orgId={business.id} />;
}
function PaperBoard({ orgId }: { orgId: Id<"orgs"> }) {
  const t = useTranslations("papers");
  const common = useTranslations("common");
  const id = useId();
  const available = useQuery(api.paperDrafts.availability, {});
  const { results, status, loadMore } = usePaginatedQuery(
    api.paperDrafts.list,
    {},
    { initialNumItems: 20 },
  );
  const upload = useAction(api.paperDrafts.upload);
  const [selected, setSelected] = useState<Id<"paperDrafts">>();
  const [draftMemory, setDraftMemory] = useState<
    Record<string, { revision: number; content: PaperContent }>
  >({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<
    "duplicate" | "invalid" | "capacity" | "error"
  >();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const isCurrent = () => mounted.current;
  return (
    <section className="flex min-w-0 flex-col gap-6">
      <AppPageHeader title={t("title")} lead={t("lead")} />
      <Link href="/app/stock" className="underline underline-offset-4">
        {t("manual")}
      </Link>
      {available && !available.assisted ? (
        <p role="status">{t("unavailable")}</p>
      ) : null}
      {available?.canOperate ? (
        <section className="flex flex-col gap-3 border-t pt-6">
          <label htmlFor={`${id}-upload`}>{t("upload")}</label>
          <Input
            id={`${id}-upload`}
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              const picker = event.currentTarget;
              picker.value = "";
              if (!file) return;
              setFailure(undefined);
              if (
                file.size > 2 * 1024 * 1024 ||
                !["image/jpeg", "image/png"].includes(file.type)
              ) {
                setFailure("invalid");
                return;
              }
              setBusy(true);
              void (async () => {
                try {
                  const bitmap = await createImageBitmap(file);
                  const isValid =
                    bitmap.width > 0 &&
                    bitmap.height > 0 &&
                    bitmap.width <= 2400 &&
                    bitmap.height <= 2400;
                  bitmap.close();
                  if (!isCurrent()) return;
                  if (!isValid) {
                    if (isCurrent()) setFailure("invalid");
                    return;
                  }
                  const bytes = await file.arrayBuffer();
                  if (!isCurrent()) return;
                  const result = await upload({
                    expectedOrgId: orgId,
                    name: file.name,
                    contentType: file.type,
                    bytes,
                  });
                  if (isCurrent()) setSelected(result.draftId);
                } catch (error) {
                  if (isCurrent()) setFailure(paperUploadProblem(error));
                } finally {
                  if (isCurrent()) setBusy(false);
                }
              })();
            }}
          />
          <p className="text-sm text-muted-foreground">{t("invalid")}</p>
          {busy ? <p role="status">{common("loading")}</p> : null}
          {failure ? (
            <p role="alert">
              {failure === "error" ? common("error") : t(failure)}
            </p>
          ) : null}
        </section>
      ) : null}
      <ol className="divide-y">
        {results.map((paper) => (
          <li
            key={paper.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <Button
              className="h-auto min-h-11 max-w-full text-start break-all whitespace-normal"
              variant="ghost"
              onClick={() => {
                setSelected(paper.id);
              }}
            >
              {paper.name}
            </Button>
            {paper.status === "confirmed" ? (
              <span>{t("confirmed")}</span>
            ) : null}
          </li>
        ))}
      </ol>
      {status === "LoadingFirstPage" ? (
        <p role="status">{common("loading")}</p>
      ) : null}
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
          {t("more")}
        </Button>
      ) : null}
      {selected ? (
        <PaperDetail
          key={selected}
          draftId={selected}
          memory={draftMemory[selected]}
          onDraftChange={(revision, content) => {
            setDraftMemory((current) => ({
              ...current,
              [selected]: { revision, content },
            }));
          }}
          assisted={Boolean(available?.assisted)}
          canOperate={Boolean(available?.canOperate)}
          onDiscard={() => {
            setSelected(undefined);
          }}
        />
      ) : null}
    </section>
  );
}
function PaperDetail({
  draftId,
  assisted,
  canOperate,
  onDiscard,
  memory,
  onDraftChange,
}: {
  memory?: { revision: number; content: PaperContent };
  onDraftChange: (revision: number, content: PaperContent) => void;
  draftId: Id<"paperDrafts">;
  assisted: boolean;
  canOperate: boolean;
  onDiscard: () => void;
}) {
  const paper = useQuery(api.paperDrafts.get, { draftId });
  if (!paper) return <ListSkeleton />;
  return (
    <PaperEditor
      key={`${paper.id}:${String(paper.revision)}`}
      paper={paper}
      initialContent={
        memory?.revision === paper.revision ? memory.content : undefined
      }
      onContentChange={(content) => {
        onDraftChange(paper.revision, content);
      }}
      assisted={assisted}
      canOperate={canOperate}
      onDiscard={onDiscard}
    />
  );
}
export function PaperEditor({
  paper,
  assisted,
  canOperate,
  onDiscard,
  initialContent,
  onContentChange,
}: {
  initialContent?: PaperContent;
  onContentChange?: (content: PaperContent) => void;
  paper: Paper;
  assisted: boolean;
  canOperate: boolean;
  onDiscard: () => void;
}) {
  const t = useTranslations("papers");
  const common = useTranslations("common");
  const id = useId();
  const [content, setContent] = useState<PaperContent>(() =>
    initialPaperContent(paper, initialContent),
  );
  const [dirty, setDirty] = useState(Boolean(initialContent));
  const [confirmed, setConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);
  const [extractFailed, setExtractFailed] = useState(false);
  const save = useMutation(api.paperDrafts.save);
  const confirm = useMutation(api.paperDrafts.confirm);
  const discard = useMutation(api.paperDrafts.discard);
  const extract = useAction(api.paperDrafts.extract);
  const isEditable = canEditPaper(paper, canOperate);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function change(next: PaperContent) {
    setContent(next);
    onContentChange?.(next);
    setDirty(true);
    setConfirmed(false);
  }
  async function perform(work: () => Promise<unknown>) {
    setBusy(true);
    setFailure(false);
    try {
      await work();
    } catch {
      if (mounted.current) setFailure(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="space-y-6 border-t pt-6" aria-label={paper.name}>
      <h2 className="text-lg font-semibold break-words">{paper.name}</h2>
      <section className="grid min-w-0 gap-6 lg:grid-cols-2">
        <PrivatePaper draftId={paper.id} />
        <section className="min-w-0 space-y-4">
          {paper.extractedContent ? (
            <details>
              <summary>{t("modelDraft")}</summary>
              <p className="break-words whitespace-pre-wrap">
                {paper.extractedContent.text}
              </p>
            </details>
          ) : null}
          {paper.status === "confirmed" ? (
            <p role="status">{t("confirmed")}</p>
          ) : null}
          <fieldset
            disabled={!isEditable || busy}
            className="min-w-0 space-y-4"
          >
            <label htmlFor={`${id}-text`}>{t("text")}</label>
            <Textarea
              id={`${id}-text`}
              value={content.text}
              maxLength={12_000}
              rows={10}
              onChange={(event) => {
                change({ ...content, text: event.target.value });
              }}
            />
            <PaperRows content={content} onChange={change} />
            {canAddPaperRow(isEditable, content) ? (
              <Button
                variant="outline"
                onClick={() => {
                  change({
                    ...content,
                    rows: [...content.rows, { ...emptyRow }],
                  });
                }}
              >
                {t("addRow")}
              </Button>
            ) : null}
          </fieldset>
          {isEditable ? (
            <>
              {assisted && paper.extractionStatus === "none" ? (
                <section className="space-y-3 border-t pt-4">
                  <label
                    htmlFor={`${id}-consent`}
                    className="flex min-h-11 items-start gap-3"
                  >
                    <Checkbox
                      id={`${id}-consent`}
                      checked={consent}
                      disabled={busy}
                      onCheckedChange={(value) => {
                        setConsent(value === true);
                      }}
                    />
                    <span>{t("consent")}</span>
                  </label>
                  {dirty ? <p>{t("saveFirst")}</p> : null}
                  <ActionButton
                    label={t("extract")}
                    variant="secondary"
                    isDisabled={!consent || busy || dirty}
                    onClick={() => {
                      void perform(async () => {
                        const result = await extract({
                          draftId: paper.id,
                          expectedRevision: paper.revision,
                          consent: true,
                        });
                        if (!mounted.current) {
                          return;
                        }

                        setConsent(false);
                        setExtractFailed(result.status !== "ok");
                      });
                    }}
                  >
                    {t("extract")}
                  </ActionButton>
                </section>
              ) : null}
              {hasFailedExtraction(paper, extractFailed) ? (
                <p role="status">{t("failed")}</p>
              ) : null}
              <label
                htmlFor={`${id}-confirm`}
                className="flex min-h-11 items-start gap-3"
              >
                <Checkbox
                  id={`${id}-confirm`}
                  checked={confirmed}
                  disabled={busy}
                  onCheckedChange={(value) => {
                    setConfirmed(value === true);
                  }}
                />
                <span>{t("confirm")}</span>
              </label>
              <section className="flex flex-wrap gap-3">
                <ActionButton
                  label={t("confirmAction")}
                  isDisabled={!canConfirmPaper(confirmed, busy, content)}
                  onClick={() => {
                    void perform(() =>
                      confirm({
                        draftId: paper.id,
                        expectedRevision: paper.revision,
                        content,
                        confirmed: true,
                      }),
                    );
                  }}
                >
                  {t("confirmAction")}
                </ActionButton>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void perform(() =>
                      save({
                        draftId: paper.id,
                        expectedRevision: paper.revision,
                        content,
                      }),
                    );
                  }}
                >
                  {common("save")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void perform(async () => {
                      await discard({
                        draftId: paper.id,
                        expectedRevision: paper.revision,
                      });
                      onDiscard();
                    });
                  }}
                >
                  {t("discard")}
                </Button>
              </section>
            </>
          ) : null}
          {paper.status === "extracting" ? (
            <p role="status">{t("pending")}</p>
          ) : null}
          {busy ? <p role="status">{common("loading")}</p> : null}
          {failure ? <p role="alert">{common("error")}</p> : null}
        </section>
      </section>
    </section>
  );
}
function PrivatePaper({ draftId }: { draftId: Id<"paperDrafts"> }) {
  const t = useTranslations("papers");
  const common = useTranslations("common");
  const read = useAction(api.paperDrafts.read);
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let isCurrent = true;
    let objectUrl: string | undefined;
    void read({ draftId })
      .then((result) => {
        if (!isCurrent) return;
        objectUrl = URL.createObjectURL(
          new Blob([result.bytes], { type: result.contentType }),
        );
        setUrl(objectUrl);
      })
      .catch(() => {
        if (isCurrent) setFailed(true);
      });
    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [draftId, read]);
  let preview;
  if (failed) preview = <p role="alert">{common("error")}</p>;
  else if (url)
    preview = (
      <Image
        src={url}
        alt={t("source")}
        width={900}
        height={1200}
        unoptimized
        className="h-auto max-h-[70vh] w-full object-contain"
      />
    );
  else preview = <p role="status">{common("loading")}</p>;
  return (
    <section className="min-w-0 space-y-3">
      <h3 className="font-medium">{t("source")}</h3>
      {preview}
    </section>
  );
}

function PaperRows({
  content,
  onChange,
}: {
  content: PaperContent;
  onChange: (content: PaperContent) => void;
}) {
  const t = useTranslations("papers");
  const format = useFormatter();
  const id = useId();
  const limits = {
    dateText: 80,
    description: 500,
    quantityText: 80,
    unitText: 40,
    amountText: 80,
    referenceText: 120,
  };
  return (
    <>
      {content.rows.length > 0 ? (
        <h3 className="font-medium">{t("rows")}</h3>
      ) : null}
      {content.rows.map((row, index) => (
        <fieldset
          key={index}
          className="grid min-w-0 gap-3 border-t pt-4 sm:grid-cols-2"
        >
          <legend>{format.number(index + 1)}</legend>
          {Object.entries(fieldNames).map(([name, label]) => {
            const field = name as keyof typeof fieldNames;
            const fieldId = `${id}-${String(index)}-${field}`;
            return (
              <label
                key={field}
                className="min-w-0 space-y-2"
                htmlFor={fieldId}
              >
                {t(label)}
                <Input
                  id={fieldId}
                  value={row[field]}
                  maxLength={limits[field]}
                  onChange={(event) => {
                    onChange({
                      ...content,
                      rows: content.rows.map((current, i) =>
                        i === index
                          ? { ...current, [field]: event.target.value }
                          : current,
                      ),
                    });
                  }}
                />
              </label>
            );
          })}
        </fieldset>
      ))}
    </>
  );
}

function initialPaperContent(paper: Paper, initial?: PaperContent) {
  return (
    initial ??
    paper.reviewedContent ??
    paper.extractedContent ?? { text: "", rows: [] }
  );
}

function canEditPaper(paper: Paper, canOperate: boolean) {
  return (
    canOperate && paper.status !== "confirmed" && paper.status !== "extracting"
  );
}

function hasFailedExtraction(paper: Paper, hasFailed: boolean) {
  return hasFailed || paper.extractionStatus === "failed";
}

function canConfirmPaper(
  isConfirmed: boolean,
  isBusy: boolean,
  content: PaperContent,
) {
  return isConfirmed && !isBusy && hasPaperContent(content);
}
function canAddPaperRow(isEditable: boolean, content: PaperContent) {
  return isEditable && content.rows.length < 30;
}

function paperUploadProblem(
  error: unknown,
): "duplicate" | "capacity" | "error" {
  if (!(error instanceof ConvexError)) return "error";
  if (error.data === "PAPER_CAPACITY") return "capacity";
  return error.data === "PAPER_DUPLICATE_SOURCE" ? "duplicate" : "error";
}
