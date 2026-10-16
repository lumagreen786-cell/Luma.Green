"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import {
  type BusinessKind,
  businessSchema,
  MATERIAL_FAMILIES,
  MAX_LOCATION_TAGS,
} from "../../../convex/lib/onboarding";
import {
  describedBy,
  FieldSet,
  FormField,
  HoursInputs,
  LocationButton,
  PhoneList,
  TagInput,
  ToggleChips,
  WeekdayChips,
  YesNo,
} from "./fields";
import { FormJourney } from "./form-journey";
import {
  ChangesNote,
  cleanGstin,
  cleanPhones,
  FormHeader,
  SubmitBar,
} from "./form-parts";
import { useAutosave, withoutUndefined } from "./use-autosave";
import type { Application } from "./use-mine";

type Values = z.input<typeof businessSchema>;
type Draft = NonNullable<Application["business"]>;

function toDraft(values: Partial<Values>): Draft {
  return withoutUndefined({
    businessName: values.businessName,
    siteType: values.siteType,
    materialOrigins: values.materialOrigins,
    gstRegistered: values.gstRegistered,
    gstin: cleanGstin(values.gstRegistered, values.gstin),
    materials: values.materials,
    address: values.address,
    location: values.location,
    locationTags: values.locationTags,
    collectsFromSuppliers: values.collectsFromSuppliers,
    phones: cleanPhones(values.phones),
    opens: values.opens,
    closes: values.closes,
    weeklyOff: values.weeklyOff,
  });
}

/**
 * Step 1 of 2 for yards, recyclers and manufacturers: the business. The path
 * picks the title; the form is the same.
 */
export function BusinessForm({
  kind,
  application,
  loginPhone,
}: {
  kind: BusinessKind;
  application: Application;
  loginPhone: string | undefined;
}) {
  const t = useTranslations("join");
  const router = useRouter();
  const saveDraft = useMutation(api.applications.saveDraft);
  const [failure, setFailure] = useState<"fixErrors" | "generic" | null>(null);
  const draft = application.business ?? {};

  const {
    control,
    register,
    handleSubmit,
    trigger,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      businessName: draft.businessName ?? "",
      siteType: draft.siteType,
      materialOrigins: draft.materialOrigins,
      gstRegistered: draft.gstRegistered,
      gstin: draft.gstin ?? "",
      materials: draft.materials ?? [],
      address: draft.address ?? "",
      location: draft.location,
      locationTags: draft.locationTags ?? [],
      collectsFromSuppliers: draft.collectsFromSuppliers,
      phones: draft.phones ?? [],
      opens: draft.opens ?? "09:00",
      closes: draft.closes ?? "18:00",
      weeklyOff: draft.weeklyOff ?? [],
    },
  });

  // Partial on purpose: a question stays unanswered until they tap it.
  const values = useWatch({ control }) as Partial<Values>;
  const saveState = useAutosave(values, async (current) => {
    await saveDraft({ business: toDraft(current) });
  });

  async function onNext(valid: Values) {
    setFailure(null);
    try {
      await saveDraft({ business: toDraft(valid) });
      router.push(`/join/${kind}/documents`);
    } catch {
      setFailure("generic");
    }
  }

  const phoneErrors = errors.phones?.map?.((phone) => ({
    number: phone?.number?.message,
    label: phone?.label?.message,
  }));
  const phoneListError = errors.phones?.root?.message ?? errors.phones?.message;
  const tagsError =
    errors.locationTags?.root?.message ?? errors.locationTags?.message;

  return (
    <FormJourney
      trigger={trigger}
      getFieldState={getFieldState}
      onFinish={(event) => {
        return handleSubmit(onNext, () => {
          setFailure("fixErrors");
        })(event);
      }}
      header={
        <>
          <FormHeader
            eyebrow={t(`roles.${kind}.title`)}
            title={t(`business.titles.${kind}`)}
            saveState={saveState}
          />
          <ChangesNote note={application.note} />
        </>
      }
      stages={[
        {
          title: t("business.businessName"),
          fields: ["businessName", "gstRegistered", "gstin", "materials"],
          content: (
            <>
              <FormField
                id="businessName"
                label={t("business.businessName")}
                error={errors.businessName?.message}
              >
                <Input
                  id="businessName"
                  autoComplete="organization"
                  className="h-12 text-base"
                  aria-invalid={errors.businessName ? true : undefined}
                  aria-describedby={describedBy(
                    "businessName",
                    errors.businessName?.message,
                  )}
                  {...register("businessName")}
                />
              </FormField>

              <FieldSet
                id="gstRegistered"
                legend={t("form.gstQuestion")}
                error={errors.gstRegistered?.message}
              >
                <Controller
                  control={control}
                  name="gstRegistered"
                  render={({ field, fieldState }) => (
                    <YesNo
                      name="gstRegistered"
                      isYes={field.value}
                      onChange={field.onChange}
                      invalid={Boolean(fieldState.error)}
                    />
                  )}
                />
              </FieldSet>
              {values.gstRegistered ? (
                <FormField
                  id="gstin"
                  label={t("form.gstin")}
                  hint={t("form.gstinHint")}
                  error={errors.gstin?.message}
                >
                  <Input
                    id="gstin"
                    dir="ltr"
                    autoCapitalize="characters"
                    maxLength={15}
                    className="h-12 font-mono text-base tracking-wider uppercase"
                    aria-invalid={errors.gstin ? true : undefined}
                    aria-describedby={describedBy(
                      "gstin",
                      errors.gstin?.message,
                      t("form.gstinHint"),
                    )}
                    {...register("gstin")}
                  />
                </FormField>
              ) : null}

              <FieldSet
                id="materials"
                legend={t("business.materials")}
                hint={t("business.materialsHint")}
                error={
                  errors.materials?.message ?? errors.materials?.root?.message
                }
              >
                <Controller
                  control={control}
                  name="materials"
                  render={({ field }) => (
                    <ToggleChips
                      options={MATERIAL_FAMILIES.map((material) => ({
                        value: material,
                        label: t(`business.materialNames.${material}`),
                      }))}
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
          title: t("business.address"),
          fields: ["address", "location", "locationTags"],
          content: (
            <>
              <FormField
                id="address"
                label={t("business.address")}
                hint={t("business.addressHint")}
                error={errors.address?.message}
              >
                <Textarea
                  id="address"
                  rows={3}
                  autoComplete="street-address"
                  className="text-base"
                  aria-invalid={errors.address ? true : undefined}
                  aria-describedby={describedBy(
                    "address",
                    errors.address?.message,
                    t("business.addressHint"),
                  )}
                  {...register("address")}
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

              <FormField
                id="locationTags"
                label={t("business.locationTags")}
                hint={t("business.locationTagsHint")}
                error={tagsError}
                optional
              >
                <Controller
                  control={control}
                  name="locationTags"
                  render={({ field }) => (
                    <TagInput
                      id="locationTags"
                      value={field.value}
                      onChange={field.onChange}
                      buttonLabel={t("business.addTag")}
                      max={MAX_LOCATION_TAGS}
                    />
                  )}
                />
              </FormField>
            </>
          ),
        },
        {
          title: t("business.hours"),
          fields: [
            "collectsFromSuppliers",
            "phones",
            "opens",
            "closes",
            "weeklyOff",
          ],
          content: (
            <>
              <FieldSet
                id="collectsFromSuppliers"
                legend={t("business.collects")}
                error={errors.collectsFromSuppliers?.message}
              >
                <Controller
                  control={control}
                  name="collectsFromSuppliers"
                  render={({ field, fieldState }) => (
                    <YesNo
                      name="collectsFromSuppliers"
                      isYes={field.value}
                      onChange={field.onChange}
                      invalid={Boolean(fieldState.error)}
                    />
                  )}
                />
              </FieldSet>

              <FieldSet
                id="phones"
                legend={t("form.otherPhones")}
                hint={t("form.otherPhonesHint")}
                error={phoneListError}
                optional
              >
                <Controller
                  control={control}
                  name="phones"
                  render={({ field }) => (
                    <PhoneList
                      loginPhone={loginPhone}
                      value={field.value}
                      onChange={field.onChange}
                      errors={phoneErrors}
                    />
                  )}
                />
              </FieldSet>

              <FieldSet
                id="hours"
                legend={t("business.hours")}
                error={errors.opens?.message ?? errors.closes?.message}
              >
                <Controller
                  control={control}
                  name="opens"
                  render={({ field: opens }) => (
                    <Controller
                      control={control}
                      name="closes"
                      render={({ field: closes }) => (
                        <HoursInputs
                          id="hours"
                          opens={opens.value}
                          closes={closes.value}
                          onOpens={opens.onChange}
                          onCloses={closes.onChange}
                          invalid={Boolean(errors.closes)}
                        />
                      )}
                    />
                  )}
                />
              </FieldSet>

              <FieldSet
                id="weeklyOff"
                legend={t("form.weeklyOff")}
                hint={t("form.weeklyOffHint")}
                optional
              >
                <Controller
                  control={control}
                  name="weeklyOff"
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
      ]}
      submit={
        <SubmitBar
          label={t("form.next")}
          busyLabel={t("form.saving")}
          isBusy={isSubmitting}
          failure={failure}
        />
      }
    />
  );
}
