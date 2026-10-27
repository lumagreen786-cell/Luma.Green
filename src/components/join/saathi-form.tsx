"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import {
  missingFiles,
  RADII_KM,
  SAATHI_TIMES,
  SAATHI_VEHICLES,
  SAATHI_WORK,
  saathiSchema,
} from "../../../convex/lib/onboarding";
import {
  describedBy,
  FieldSet,
  FormField,
  LocationButton,
  OptionCards,
  ToggleChips,
  WeekdayChips,
} from "./fields";
import { FileSlot } from "./file-slot";
import { FormJourney } from "./form-journey";
import { ChangesNote, FormHeader, SubmitBar } from "./form-parts";
import { resumeStage } from "./resume-stage";
import { submitErrorKey, type SubmitFailure } from "./submit-error";
import { useAutosave, withoutUndefined } from "./use-autosave";
import type { Application } from "./use-mine";

type Values = z.input<typeof saathiSchema>;
type Draft = NonNullable<Application["saathi"]>;

function toDraft(values: Partial<Values>): Draft {
  const radius = RADII_KM.find((km) => km === values.radiusKm);
  return withoutUndefined({
    name: values.name,
    area: values.area,
    location: values.location,
    radiusKm: radius,
    workTypes: values.workTypes,
    vehicle: values.vehicle,
    times: values.times,
    days: values.days,
  });
}

function radiusChoice(km: number | undefined): string | undefined {
  return km === undefined ? undefined : String(km);
}

/** `/join/saathi`: the person, the work they want, their ID and a selfie. */
export function SaathiForm({ application }: { application: Application }) {
  const t = useTranslations("join");
  const router = useRouter();
  const saveDraft = useMutation(api.applications.saveDraft);
  const submit = useMutation(api.applications.submit);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [showFileErrors, setShowFileErrors] = useState(false);
  const draft = application.saathi ?? {};

  const {
    control,
    register,
    handleSubmit,
    trigger,
    getFieldState,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(saathiSchema),
    defaultValues: {
      name: draft.name ?? "",
      area: draft.area ?? "",
      location: draft.location,
      radiusKm: draft.radiusKm,
      workTypes: draft.workTypes ?? [],
      vehicle: draft.vehicle,
      times: draft.times ?? [],
      days: draft.days ?? [],
    },
  });

  const [initialStage] = useState(() => {
    const parsed = saathiSchema.safeParse(getValues());
    return resumeStage(
      [
        ["name", "area", "location", "radiusKm"],
        ["workTypes", "vehicle", "times", "days"],
        [],
      ],
      parsed.success ? [] : parsed.error.issues,
    );
  });

  // Partial on purpose: a question stays unanswered until they tap it.
  const values = useWatch({ control }) as Partial<Values>;
  const saveState = useAutosave(values, async (current) => {
    await saveDraft({ saathi: toDraft(current) });
  });

  const idProofs = application.files.filter((file) => file.type === "id_proof");
  const selfies = application.files.filter((file) => file.type === "selfie");
  const missing = missingFiles(
    "saathi",
    { id_proof: idProofs.length, selfie: selfies.length },
    false,
  );

  async function onSubmit(valid: Values) {
    setFailure(null);
    setShowFileErrors(true);
    if (missing.length > 0) {
      setFailure("fixErrors");
      return;
    }
    try {
      await saveDraft({ saathi: toDraft(valid) });
      await submit({});
      router.push("/app");
    } catch (error) {
      setFailure(submitErrorKey(error));
    }
  }

  const fileError = (type: "id_proof" | "selfie") =>
    showFileErrors && missing.includes(type) ? "fileMissing" : undefined;

  return (
    <FormJourney
      initialStage={initialStage}
      trigger={trigger}
      getFieldState={getFieldState}
      onFinish={(event) => {
        return handleSubmit(onSubmit, () => {
          setShowFileErrors(true);
          setFailure("fixErrors");
        })(event);
      }}
      header={
        <>
          <FormHeader
            eyebrow={t("roles.saathi.title")}
            title={t("saathi.title")}
            saveState={saveState}
          />
          <ChangesNote note={application.note} />
        </>
      }
      stages={[
        {
          title: t("saathi.area"),
          fields: ["name", "area", "location", "radiusKm"],
          content: (
            <>
              <FormField
                id="name"
                label={t("saathi.name")}
                hint={t("saathi.nameHint")}
                error={errors.name?.message}
              >
                <Input
                  id="name"
                  autoComplete="name"
                  className="h-12 text-base"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describedBy(
                    "name",
                    errors.name?.message,
                    t("saathi.nameHint"),
                  )}
                  {...register("name")}
                />
              </FormField>

              <FormField
                id="area"
                label={t("saathi.area")}
                hint={t("saathi.areaHint")}
                error={errors.area?.message}
              >
                <Input
                  id="area"
                  autoComplete="address-level3"
                  className="h-12 text-base"
                  aria-invalid={errors.area ? true : undefined}
                  aria-describedby={describedBy(
                    "area",
                    errors.area?.message,
                    t("saathi.areaHint"),
                  )}
                  {...register("area")}
                />
              </FormField>
              <Controller
                control={control}
                name="location"
                render={({ field }) => (
                  <LocationButton
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <FieldSet
                id="radiusKm"
                legend={t("saathi.radius")}
                error={errors.radiusKm?.message}
              >
                <Controller
                  control={control}
                  name="radiusKm"
                  render={({ field, fieldState }) => (
                    <OptionCards
                      name="radiusKm"
                      columns={3}
                      options={RADII_KM.map((km) => ({
                        value: String(km),
                        label: t("saathi.radiusOption", { km }),
                      }))}
                      // Unanswered until they tap one, whatever the type says.
                      value={radiusChoice(field.value)}
                      onChange={(next) => {
                        field.onChange(Number(next));
                      }}
                      invalid={Boolean(fieldState.error)}
                    />
                  )}
                />
              </FieldSet>
            </>
          ),
        },
        {
          title: t("saathi.workTypes"),
          fields: ["workTypes", "vehicle", "times", "days"],
          content: (
            <>
              <FieldSet
                id="workTypes"
                legend={t("saathi.workTypes")}
                error={
                  errors.workTypes?.message ?? errors.workTypes?.root?.message
                }
              >
                <Controller
                  control={control}
                  name="workTypes"
                  render={({ field }) => (
                    <ToggleChips
                      options={SAATHI_WORK.map((work) => ({
                        value: work,
                        label: t(`saathi.work.${work}`),
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FieldSet>

              <FieldSet
                id="vehicle"
                legend={t("saathi.vehicle")}
                error={errors.vehicle?.message}
              >
                <Controller
                  control={control}
                  name="vehicle"
                  render={({ field, fieldState }) => (
                    <OptionCards
                      name="vehicle"
                      options={SAATHI_VEHICLES.map((vehicle) => ({
                        value: vehicle,
                        label: t(`saathi.vehicles.${vehicle}`),
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={Boolean(fieldState.error)}
                    />
                  )}
                />
              </FieldSet>

              <FieldSet
                id="times"
                legend={t("saathi.times")}
                error={errors.times?.message ?? errors.times?.root?.message}
              >
                <Controller
                  control={control}
                  name="times"
                  render={({ field }) => (
                    <ToggleChips
                      options={SAATHI_TIMES.map((time) => ({
                        value: time,
                        label: t(`saathi.timeNames.${time}`),
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FieldSet>

              <FieldSet
                id="days"
                legend={t("saathi.days")}
                error={errors.days?.message ?? errors.days?.root?.message}
              >
                <Controller
                  control={control}
                  name="days"
                  render={({ field }) => (
                    <WeekdayChips
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </FieldSet>
            </>
          ),
        },
        {
          title: t("saathi.idProof"),
          fields: [],
          content: (
            <>
              <FileSlot
                type="id_proof"
                files={idProofs}
                label={t("saathi.idProof")}
                hint={t("saathi.idProofHint")}
                error={fileError("id_proof")}
              />
              <FileSlot
                type="selfie"
                files={selfies}
                label={t("saathi.selfie")}
                hint={t("saathi.selfieHint")}
                error={fileError("selfie")}
                capture="user"
              />
            </>
          ),
        },
      ]}
      submit={
        <SubmitBar
          label={t("form.submit")}
          busyLabel={t("form.submitting")}
          isBusy={isSubmitting}
          failure={failure}
        />
      }
    />
  );
}
