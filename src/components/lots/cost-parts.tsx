"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { useCanOperate } from "@/components/workspace/permissions";
import { formatPaise } from "@/lib/money-format";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  EvidenceDialog,
  FormStatus,
  LotField,
  useEvidenceAction,
} from "./form-parts";
import { acquisitionCostSchema, parseGrams } from "./logic";

export function RecordedCost({ paise }: { paise: number | null | undefined }) {
  const t = useTranslations("recordedCosts");
  const locale = useLocale();
  return (
    <span className="tabular-nums">
      {paise == null ? t("unknown") : formatPaise(paise, locale)}
    </span>
  );
}

export function ProcessingCostSummary({
  consumedInputCostPaise,
  processingCostPaise,
  totalOutputCostPaise,
}: {
  consumedInputCostPaise?: number | null;
  processingCostPaise?: number | null;
  totalOutputCostPaise?: number | null;
}) {
  const t = useTranslations("recordedCosts");
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      {(
        [
          ["input", consumedInputCostPaise],
          ["processingTotal", processingCostPaise],
          ["total", totalOutputCostPaise],
        ] as const
      ).map(([key, cost]) => (
        <div key={key}>
          <dt className="text-muted-foreground">{t(key)}</dt>
          <dd>
            <RecordedCost paise={cost} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordAcquisitionCost({
  lotId,
}: {
  lotId: Id<"materialLots">;
}) {
  const t = useTranslations("recordedCosts");
  const [open, setOpen] = useState(false);
  const canOperate = useCanOperate();
  const action = useEvidenceAction();
  const save = useMutation(api.traceability.recordAcquisitionCost);
  const form = useForm<z.infer<typeof acquisitionCostSchema>>({
    resolver: zodResolver(acquisitionCostSchema),
    defaultValues: { costPaise: "", costReference: "" },
  });
  if (!canOperate) return null;
  return (
    <EvidenceDialog
      title={t("record")}
      hint={t("hint")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        if (!form.formState.isSubmitting) setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          void form.handleSubmit(async (values) => {
            await action.run(
              () =>
                save({
                  lotId,
                  acquisitionCostPaise: parseGrams(values.costPaise) ?? 0,
                  costReference: values.costReference,
                }),
              () => {
                form.reset();
                setOpen(false);
              },
            );
          })(event);
        }}
      >
        <fieldset
          disabled={form.formState.isSubmitting}
          className="flex flex-col gap-4"
        >
          <LotField
            label={t("acquisition")}
            inputMode="numeric"
            registration={form.register("costPaise")}
            invalid={Boolean(form.formState.errors.costPaise)}
          />
          <LotField
            label={t("reference")}
            maxLength={500}
            registration={form.register("costReference")}
            invalid={Boolean(form.formState.errors.costReference)}
          />
          <FormStatus
            busy={form.formState.isSubmitting}
            invalid={Object.keys(form.formState.errors).length > 0}
            invalidMessage={t("hint")}
            failure={action.failure}
          />
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}
