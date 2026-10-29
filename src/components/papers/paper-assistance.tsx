"use client";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { localeMeta, locales } from "@/i18n/locales";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
type Item = FunctionReturnType<typeof api.paperAssist.list>[number];
export interface AssistDraft {
  revision: number;
  text: string;
  previousText?: string;
}
export type AssistMemory = Record<string, AssistDraft>;
export function PaperAssistance({
  draftId,
  orgId,
  memory,
  remember,
}: {
  draftId: Id<"paperDrafts">;
  orgId: Id<"orgs">;
  memory: AssistMemory;
  remember: (id: string, draft: AssistDraft) => void;
}) {
  const t = useTranslations("paperAssist");
  const common = useTranslations("common");
  const locale = useLocale();
  const id = useId();
  const paper = useQuery(api.paperDrafts.get, { draftId });
  const isReady =
    paper?.status === "confirmed" &&
    Boolean(paper.reviewedContent?.text.trim());
  const available = useQuery(
    api.paperAssist.availability,
    isReady ? {} : "skip",
  );
  const items = useQuery(api.paperAssist.list, isReady ? { draftId } : "skip");
  const create = useMutation(api.paperAssist.create);
  const [mode, setMode] = useState<"summary" | "translation">("summary");
  const [language, setLanguage] = useState(locale);
  const [selected, setSelected] = useState<Id<"paperAssists">>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (!isReady)
    return paper?.status === "confirmed" ? (
      <p role="status">{t("emptySource")}</p>
    ) : null;
  const item = items?.find((row) => row.id === selected);
  return (
    <section
      className="min-w-0 space-y-4 border-t pt-6"
      aria-label={t("title")}
    >
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p>{t("lead")}</p>
      {available?.assisted ? null : <p role="status">{t("unavailable")}</p>}
      {available?.canOperate ? (
        <section className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <label htmlFor={`${id}-mode`}>{t("task")}</label>
            <Select
              value={mode}
              disabled={busy}
              onValueChange={(value) => {
                if (value === "summary" || value === "translation")
                  setMode(value);
              }}
            >
              <SelectTrigger id={`${id}-mode`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">{t("summary")}</SelectItem>
                <SelectItem value="translation">{t("translation")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-language`}>{t("language")}</label>
            <Select
              value={language}
              disabled={busy}
              onValueChange={setLanguage}
            >
              <SelectTrigger id={`${id}-language`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((code) => (
                  <SelectItem value={code} key={code}>
                    {localeMeta[code].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ActionButton
            label={t("create")}
            isDisabled={busy || !items || items.length >= 10}
            onClick={() => {
              setBusy(true);
              setFailed(false);
              void create({
                draftId,
                expectedPaperRevision: paper.revision,
                expectedOrgId: orgId,
                mode,
                targetLocale: language,
              })
                .then((result) => {
                  if (mounted.current) setSelected(result.assistId);
                })
                .catch(() => {
                  if (mounted.current) setFailed(true);
                })
                .finally(() => {
                  if (mounted.current) setBusy(false);
                });
            }}
          >
            {t("create")}
          </ActionButton>
        </section>
      ) : null}
      {items && items.length >= 10 ? (
        <p role="status">{t("capacity")}</p>
      ) : null}
      {!items || busy ? <p role="status">{common("loading")}</p> : null}
      {failed ? <p role="alert">{common("error")}</p> : null}
      <ol className="divide-y">
        {items?.map((row) => (
          <li key={row.id} className="py-2">
            <Button
              variant="ghost"
              aria-pressed={row.id === selected}
              onClick={() => {
                setSelected(row.id);
              }}
            >
              {t(row.mode)} ·{" "}
              {localeMeta[row.targetLocale as keyof typeof localeMeta].label}
              {row.status === "confirmed" ? ` · ${t("confirmed")}` : ""}
            </Button>
          </li>
        ))}
      </ol>
      {item ? (
        <AssistEditor
          key={item.id}
          item={item}
          available={Boolean(available?.assisted)}
          canOperate={Boolean(available?.canOperate)}
          initialDraft={memory[item.id]}
          remember={(draft) => {
            remember(item.id, draft);
          }}
          onDiscard={() => {
            setSelected(undefined);
          }}
        />
      ) : null}
    </section>
  );
}
export function AssistEditor({
  item,
  available,
  canOperate,
  initialDraft,
  remember,
  onDiscard,
}: {
  item: Item;
  available: boolean;
  canOperate: boolean;
  initialDraft?: AssistDraft;
  remember: (draft: AssistDraft) => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("paperAssist");
  const common = useTranslations("common");
  const id = useId();
  const [text, setText] = useState(initialDraft?.text ?? item.reviewedText);
  const [baseRevision, setBaseRevision] = useState(
    initialDraft?.revision ?? item.revision,
  );
  const [previousText, setPreviousText] = useState(initialDraft?.previousText);
  const [consent, setConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);
  const [providerFailed, setProviderFailed] = useState(false);
  const save = useMutation(api.paperAssist.save);
  const confirm = useMutation(api.paperAssist.confirm);
  const discard = useMutation(api.paperAssist.discard);
  const generate = useAction(api.paperAssist.generate);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const hasConflict = item.revision !== baseRevision;
  const isEditable = canOperate && item.status === "draft" && !busy;
  function change(value: string) {
    setText(value);
    remember({
      revision: baseRevision,
      text: value,
      ...(previousText !== undefined && { previousText }),
    });
    setReviewed(false);
  }
  function reload() {
    const previous = text === item.reviewedText ? previousText : text;
    setPreviousText(previous);
    setText(item.reviewedText);
    setBaseRevision(item.revision);
    setConsent(false);
    setReviewed(false);
    setFailure(false);
    remember({
      revision: item.revision,
      text: item.reviewedText,
      ...(previous !== undefined && { previousText: previous }),
    });
  }
  function acceptRevision(revision: number) {
    if (!mounted.current) return;
    setBaseRevision(revision);
    setReviewed(false);
    remember({
      revision,
      text,
      ...(previousText !== undefined && { previousText }),
    });
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
    <section className="min-w-0 space-y-4 border-t pt-4">
      <AssistRecovery
        hasConflict={hasConflict}
        previousText={previousText}
        savedText={item.reviewedText}
        isBusy={busy}
        onReload={reload}
      />
      <details>
        <summary>{t("source")}</summary>
        <p className="break-words whitespace-pre-wrap">{item.sourceText}</p>
      </details>
      {item.modelText === undefined ? null : (
        <section className="space-y-3">
          <h3>{t("model")}</h3>
          <p className="break-words whitespace-pre-wrap" dir="auto">
            {item.modelText}
          </p>
          {isEditable && !hasConflict ? (
            <ActionButton
              label={t("useModel")}
              variant="secondary"
              onClick={() => {
                change(item.modelText ?? "");
              }}
            >
              {t("useModel")}
            </ActionButton>
          ) : null}
        </section>
      )}
      <label htmlFor={`${id}-text`}>{t("reviewedText")}</label>
      <Textarea
        id={`${id}-text`}
        dir="auto"
        value={item.status === "confirmed" ? item.reviewedText : text}
        rows={8}
        maxLength={12_000}
        disabled={!isEditable || hasConflict}
        onChange={(event) => {
          change(event.target.value);
        }}
      />
      {item.status === "confirmed" ? (
        <p role="status">{t("confirmed")}</p>
      ) : null}
      {item.status === "pending" ? <p role="status">{t("pending")}</p> : null}
      {isEditable ? (
        <>
          {available && item.attemptStatus === "none" ? (
            <section className="space-y-3">
              <label
                className="flex min-h-11 items-start gap-3"
                htmlFor={`${id}-consent`}
              >
                <Checkbox
                  id={`${id}-consent`}
                  disabled={hasConflict}
                  checked={consent && !hasConflict}
                  onCheckedChange={(value) => {
                    setConsent(value === true);
                  }}
                />
                <span>{t("consent")}</span>
              </label>
              <ActionButton
                label={t("generate")}
                variant="secondary"
                isDisabled={!consent || hasConflict}
                onClick={() => {
                  void perform(async () => {
                    const result = await generate({
                      assistId: item.id,
                      expectedRevision: baseRevision,
                      consent: true,
                    });
                    if (!mounted.current) {
                      return;
                    }

                    setConsent(false);
                    setProviderFailed(result.status !== "ok");
                  });
                }}
              >
                {t("generate")}
              </ActionButton>
            </section>
          ) : null}
          <label
            className="flex min-h-11 items-start gap-3"
            htmlFor={`${id}-review`}
          >
            <Checkbox
              id={`${id}-review`}
              disabled={hasConflict}
              checked={reviewed && !hasConflict}
              onCheckedChange={(value) => {
                setReviewed(value === true);
              }}
            />
            <span>{t("review")}</span>
          </label>
          <section className="flex flex-wrap gap-3">
            <ActionButton
              label={t("confirm")}
              isDisabled={hasConflict || !reviewed || !text.trim()}
              onClick={() => {
                void perform(async () => {
                  const result = await confirm({
                    assistId: item.id,
                    expectedRevision: baseRevision,
                    text,
                    confirmed: true,
                  });
                  acceptRevision(result.revision);
                });
              }}
            >
              {t("confirm")}
            </ActionButton>
            <ActionButton
              label={common("save")}
              variant="secondary"
              isDisabled={hasConflict}
              onClick={() => {
                void perform(async () => {
                  const result = await save({
                    assistId: item.id,
                    expectedRevision: baseRevision,
                    text,
                  });
                  acceptRevision(result.revision);
                });
              }}
            >
              {common("save")}
            </ActionButton>
            <ActionButton
              label={t("discard")}
              variant="secondary"
              isDisabled={hasConflict}
              onClick={() => {
                void perform(async () => {
                  await discard({
                    assistId: item.id,
                    expectedRevision: baseRevision,
                  });
                  if (mounted.current) onDiscard();
                });
              }}
            >
              {t("discard")}
            </ActionButton>
          </section>
        </>
      ) : null}
      {providerFailed || item.attemptStatus === "failed" ? (
        <p role="status">{t("failed")}</p>
      ) : null}
      {busy ? <p role="status">{common("loading")}</p> : null}
      {failure ? <p role="alert">{common("error")}</p> : null}
    </section>
  );
}

/** Fragment preserves the editor's existing sibling layout and recovery controls. */
function AssistRecovery({
  hasConflict,
  previousText,
  savedText,
  isBusy,
  onReload,
}: {
  hasConflict: boolean;
  previousText: string | undefined;
  savedText: string;
  isBusy: boolean;
  onReload: () => void;
}) {
  const t = useTranslations("paperAssist");
  return (
    <>
      {hasConflict ? (
        <section className="space-y-3" role="alert">
          <p>{t("conflict")}</p>
          <details>
            <summary>{t("savedText")}</summary>
            <p className="break-words whitespace-pre-wrap" dir="auto">
              {savedText}
            </p>
          </details>
          <ActionButton
            label={t("reload")}
            variant="secondary"
            isDisabled={isBusy}
            onClick={onReload}
          >
            {t("reload")}
          </ActionButton>
        </section>
      ) : null}
      {previousText === undefined ? null : (
        <details>
          <summary>{t("localDraft")}</summary>
          <p className="break-words whitespace-pre-wrap" dir="auto">
            {previousText}
          </p>
        </details>
      )}
    </>
  );
}
