"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import {
  type BusinessKind,
  businessSchema,
  documentsSchema,
  indiaToday,
  missingFiles,
  PCB_BOARDS,
} from "../../../convex/lib/onboarding";
import { describedBy, FieldSet, FormField, OptionCards } from "./fields";
import { FileSlot } from "./file-slot";
import { ChangesNote, FormHeader, SubmitBar } from "./form-parts";
import { submitErrorKey } from "./submit-error";
import { useAutosave, withoutUndefined } from "./use-autosave";
import type { Application } from "./use-mine";

type Draft = NonNullable<Application["documents"]>;

function toDraft(values: Partial<Draft>): Draft {
  const isNotRequired = values.pcbNotRequired === true;
  return withoutUndefined({
    pcbNotRequired: values.pcbNotRequired ?? false,
    notRequiredReason: isNotRequired ? values.notRequiredReason : undefined,
    board: isNotRequired ? undefined : values.board,
    boardState:
      !isNotRequired && values.board === "other"
        ? values.boardState
        : undefined,
    consentNumber: isNotRequired ? undefined : values.consentNumber,
    validUntil: isNotRequired ? undefined : values.validUntil,
    declaration: values.declaration,
  });
}

/**
 * Step 2 of 2 for yards, recyclers and manufacturers: the pollution-control
 * consent, machine photos, and the declaration — then send.
 */
export function DocumentsForm({
  kind,
  application,
}: {
  kind: BusinessKind;
  application: Application;
}) {
  const t = useTranslations("join");
  const router = useRouter();
  const saveDraft = useMutation(api.applications.saveDraft);
  const submit = useMutation(api.applications.submit);
  const [failure, setFailure] = useState<"fixErrors" | "generic" | null>(null);
  const [showFileErrors, setShowFileErrors] = useState(false);
  const today = indiaToday();
  const schema = useMemo(() => documentsSchema(today), [today]);
  type Values = z.input<typeof schema>;
  const draft = application.documents ?? {};

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      pcbNotRequired: draft.pcbNotRequired ?? false,
      notRequiredReason: draft.notRequiredReason ?? "",
      board: draft.board,
      boardState: draft.boardState ?? "",
      consentNumber: draft.consentNumber ?? "",
      validUntil: draft.validUntil ?? "",
      declaration: draft.declaration === true || undefined,
    },
  });

  // Partial on purpose: a question stays unanswered until they tap it.
  const values = useWatch({ control }) as Partial<Values>;
  const saveState = useAutosave(values, async (current) => {
    await saveDraft({ documents: toDraft(current) });
  });

  const certificates = application.files.filter(
    (file) => file.type === "pcb_certificate",
  );
  const media = application.files.filter(
    (file) => file.type === "machine_media",
  );
  const missing = missingFiles(
    kind,
    { pcb_certificate: certificates.length, machine_media: media.length },
    values.pcbNotRequired === true,
  );
  const isStepOneDone = businessSchema.safeParse({
    phones: [],
    weeklyOff: [],
    locationTags: [],
    ...application.business,
  }).success;

  async function onSubmit(valid: Values) {
    setFailure(null);
    setShowFileErrors(true);
    if (!isStepOneDone || missing.length > 0) {
      setFailure("fixErrors");
      return;
    }
    try {
      await saveDraft({ documents: toDraft(valid) });
      await submit({});
      router.push("/join/status");
    } catch (error) {
      setFailure(submitErrorKey(error));
    }
  }

  const fileError = (type: "pcb_certificate" | "machine_media") =>
    showFileErrors && missing.includes(type) ? "fileMissing" : undefined;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(onSubmit, () => {
          setShowFileErrors(true);
          setFailure("fixErrors");
        })(event);
      }}
    >
      <FormHeader
        eyebrow={t(`roles.${kind}.title`)}
        title={t("documents.title")}
        saveState={saveState}
      />
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("documents.lead")}
      </p>
      <ChangesNote note={application.note} />
      {isStepOneDone ? null : (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm">
          {t("form.fixErrors")}{" "}
          <Link href={`/join/${kind}`} className="font-medium underline">
            {t("form.back")}
          </Link>
        </p>
      )}

      <div className="flex items-start gap-3">
        <Controller
          control={control}
          name="pcbNotRequired"
          render={({ field }) => (
            <Checkbox
              id="pcbNotRequired"
              className="mt-0.5 size-5"
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked === true);
              }}
              aria-describedby="pcbNotRequired-hint"
            />
          )}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor="pcbNotRequired" className="text-base">
            {t("documents.notRequired")}
          </Label>
          <p id="pcbNotRequired-hint" className="text-sm text-muted-foreground">
            {t("documents.notRequiredHint")}
          </p>
        </div>
      </div>

      {values.pcbNotRequired ? (
        <FormField
          id="notRequiredReason"
          label={t("documents.reason")}
          error={errors.notRequiredReason?.message}
        >
          <Textarea
            id="notRequiredReason"
            rows={3}
            className="text-base"
            aria-invalid={errors.notRequiredReason ? true : undefined}
            aria-describedby={describedBy(
              "notRequiredReason",
              errors.notRequiredReason?.message,
            )}
            {...register("notRequiredReason")}
          />
        </FormField>
      ) : (
        <>
          <FieldSet
            id="board"
            legend={t("documents.board")}
            error={errors.board?.message}
          >
            <Controller
              control={control}
              name="board"
              render={({ field, fieldState }) => (
                <OptionCards
                  name="board"
                  columns={1}
                  options={PCB_BOARDS.map((board) => ({
                    value: board,
                    label: t(`documents.boards.${board}`),
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(fieldState.error)}
                />
              )}
            />
          </FieldSet>
          {values.board === "other" ? (
            <FormField
              id="boardState"
              label={t("documents.boardState")}
              error={errors.boardState?.message}
            >
              <Input
                id="boardState"
                className="h-12 text-base"
                aria-invalid={errors.boardState ? true : undefined}
                aria-describedby={describedBy(
                  "boardState",
                  errors.boardState?.message,
                )}
                {...register("boardState")}
              />
            </FormField>
          ) : null}
          <FormField
            id="consentNumber"
            label={t("documents.consentNumber")}
            hint={t("documents.consentNumberHint")}
            error={errors.consentNumber?.message}
          >
            <Input
              id="consentNumber"
              dir="ltr"
              className="h-12 text-base"
              aria-invalid={errors.consentNumber ? true : undefined}
              aria-describedby={describedBy(
                "consentNumber",
                errors.consentNumber?.message,
                t("documents.consentNumberHint"),
              )}
              {...register("consentNumber")}
            />
          </FormField>
          <FormField
            id="validUntil"
            label={t("documents.validUntil")}
            error={errors.validUntil?.message}
          >
            <Input
              id="validUntil"
              type="date"
              min={today}
              className="h-12 text-base"
              aria-invalid={errors.validUntil ? true : undefined}
              aria-describedby={describedBy(
                "validUntil",
                errors.validUntil?.message,
              )}
              {...register("validUntil")}
            />
          </FormField>
          <FileSlot
            type="pcb_certificate"
            files={certificates}
            label={t("documents.certificate")}
            hint={t("documents.certificateHint")}
            error={fileError("pcb_certificate")}
          />
        </>
      )}

      <FileSlot
        type="machine_media"
        files={media}
        label={t("documents.machineMedia")}
        hint={t("documents.machineMediaHint")}
        error={fileError("machine_media")}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="declaration"
            render={({ field }) => (
              <Checkbox
                id="declaration"
                className="mt-0.5 size-5"
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked === true);
                }}
                aria-invalid={errors.declaration ? true : undefined}
              />
            )}
          />
          <Label htmlFor="declaration" className="text-base font-normal">
            {t("documents.declaration")}
          </Label>
        </div>
        {errors.declaration?.message ? (
          <p role="alert" className="text-sm text-destructive">
            {t(`errors.${errors.declaration.message}`)}
          </p>
        ) : null}
      </div>

      <SubmitBar
        label={t("form.submit")}
        busyLabel={t("form.submitting")}
        isBusy={isSubmitting}
        failure={failure}
        secondary={
          <Button asChild variant="ghost">
            <Link href={`/join/${kind}`}>{t("form.back")}</Link>
          </Button>
        }
      />
    </form>
  );
}
