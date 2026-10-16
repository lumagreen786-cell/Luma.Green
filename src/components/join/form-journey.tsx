"use client";

import { useTranslations } from "next-intl";
import {
  type ReactNode,
  type SubmitEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  FieldPath,
  FieldValues,
  UseFormGetFieldState,
  UseFormTrigger,
} from "react-hook-form";

import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";

/** Keep every stage mounted so form values and file uploads survive Back. */
export function FormJourney<T extends FieldValues>({
  header,
  stages,
  trigger,
  getFieldState,
  onFinish,
  submit,
}: {
  header: ReactNode;
  stages: { title: string; fields: FieldPath<T>[]; content: ReactNode }[];
  trigger: UseFormTrigger<T>;
  getFieldState: UseFormGetFieldState<T>;
  onFinish: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
  submit: ReactNode;
}) {
  const t = useTranslations("auth");
  const join = useTranslations("join.form");
  const progress = useTranslations("sell.steps");
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const isLast = stage === stages.length - 1;
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);

  async function advance(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const isValid = await trigger(
        isLast ? undefined : stages[stage]?.fields,
        {
          shouldFocus: true,
        },
      );
      if (!isValid) {
        if (isLast) {
          const invalid = stages.findIndex((item) =>
            item.fields.some((field) => getFieldState(field).invalid),
          );
          if (invalid !== -1) setStage(invalid);
        }
        return;
      }
      if (isLast) await onFinish(event);
      else setStage((current) => current + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void advance(event);
      }}
    >
      {header}
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {progress("progress", { current: stage + 1, total: stages.length })}
        </span>
        {stage > 0 ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setStage((current) => current - 1);
            }}
          >
            {join("back")}
          </Button>
        ) : null}
      </div>
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {stages[stage]?.title}
      </h2>
      {stages.map((item, index) => (
        <div key={item.title} hidden={index !== stage}>
          <div className="flex flex-col gap-5">{item.content}</div>
        </div>
      ))}
      {isLast ? (
        submit
      ) : (
        <ActionButton
          type="submit"
          label={t("continue")}
          isDisabled={busy}
          className="w-full"
        />
      )}
    </form>
  );
}
