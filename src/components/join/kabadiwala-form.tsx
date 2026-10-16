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
  kabadiwalaSchema,
  SHOP_VEHICLES,
} from "../../../convex/lib/onboarding";
import {
  describedBy,
  FieldSet,
  FormField,
  HoursInputs,
  LocationButton,
  OptionCards,
  PhoneList,
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
import { submitErrorKey } from "./submit-error";
import { useAutosave, withoutUndefined } from "./use-autosave";
import type { Application } from "./use-mine";

type Values = z.input<typeof kabadiwalaSchema>;
type Draft = NonNullable<Application["kabadiwala"]>;

function toDraft(values: Partial<Values>): Draft {
  return withoutUndefined({
    ownerName: values.ownerName,
    shopName: values.shopName,
    gstRegistered: values.gstRegistered,
    gstin: cleanGstin(values.gstRegistered, values.gstin),
    address: values.address,
    location: values.location,
    offersPickup: values.offersPickup,
    vehicle: values.offersPickup ? values.vehicle : undefined,
    phones: cleanPhones(values.phones),
    opens: values.opens,
    closes: values.closes,
    weeklyOff: values.weeklyOff,
  });
}

/** `/join/kabadiwala`: one screen, one "Send for verification". */
export function KabadiwalaForm({
  application,
  loginPhone,
}: {
  application: Application;
  loginPhone: string | undefined;
}) {
  const t = useTranslations("join");
  const router = useRouter();
  const saveDraft = useMutation(api.applications.saveDraft);
  const submit = useMutation(api.applications.submit);
  const [failure, setFailure] = useState<"fixErrors" | "generic" | null>(null);
  const draft = application.kabadiwala ?? {};

  const {
    control,
    register,
    handleSubmit,
    trigger,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(kabadiwalaSchema),
    defaultValues: {
      ownerName: draft.ownerName ?? "",
      shopName: draft.shopName ?? "",
      gstRegistered: draft.gstRegistered,
      gstin: draft.gstin ?? "",
      address: draft.address ?? "",
      location: draft.location,
      offersPickup: draft.offersPickup,
      vehicle: draft.vehicle,
      phones: draft.phones ?? [],
      opens: draft.opens ?? "09:00",
      closes: draft.closes ?? "20:00",
      weeklyOff: draft.weeklyOff ?? [],
    },
  });

  // Partial on purpose: a question stays unanswered until they tap it.
  const values = useWatch({ control }) as Partial<Values>;
  const saveState = useAutosave(values, async (current) => {
    await saveDraft({ kabadiwala: toDraft(current) });
  });

  async function onSubmit(valid: Values) {
    setFailure(null);
    try {
      await saveDraft({ kabadiwala: toDraft(valid) });
      await submit({});
      router.push("/join/status");
    } catch (error) {
      setFailure(submitErrorKey(error));
    }
  }

  const phoneErrors = errors.phones?.map?.((phone) => ({
    number: phone?.number?.message,
    label: phone?.label?.message,
  }));
  const phoneListError = errors.phones?.root?.message ?? errors.phones?.message;

  return (
    <FormJourney
      trigger={trigger}
      getFieldState={getFieldState}
      onFinish={(event) => {
        return handleSubmit(onSubmit, () => {
          setFailure("fixErrors");
        })(event);
      }}
      header={
        <>
          <FormHeader
            eyebrow={t("roles.kabadiwala.title")}
            title={t("kabadiwala.title")}
            saveState={saveState}
          />
          <ChangesNote note={application.note} />
        </>
      }
      stages={[
        {
          title: t("kabadiwala.ownerName"),
          fields: ["ownerName", "shopName", "gstRegistered", "gstin"],
          content: (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  id="ownerName"
                  label={t("kabadiwala.ownerName")}
                  error={errors.ownerName?.message}
                >
                  <Input
                    id="ownerName"
                    autoComplete="name"
                    className="h-12 text-base"
                    aria-invalid={errors.ownerName ? true : undefined}
                    aria-describedby={describedBy(
                      "ownerName",
                      errors.ownerName?.message,
                    )}
                    {...register("ownerName")}
                  />
                </FormField>

                <FormField
                  id="shopName"
                  label={t("kabadiwala.shopName")}
                  error={errors.shopName?.message}
                >
                  <Input
                    id="shopName"
                    autoComplete="organization"
                    className="h-12 text-base"
                    aria-invalid={errors.shopName ? true : undefined}
                    aria-describedby={describedBy(
                      "shopName",
                      errors.shopName?.message,
                    )}
                    {...register("shopName")}
                  />
                </FormField>
              </div>

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
            </>
          ),
        },
        {
          title: t("kabadiwala.address"),
          fields: ["address", "location"],
          content: (
            <>
              <FormField
                id="address"
                label={t("kabadiwala.address")}
                hint={t("kabadiwala.addressHint")}
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
                    t("kabadiwala.addressHint"),
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
            </>
          ),
        },
        {
          title: t("kabadiwala.offersPickup"),
          fields: [
            "offersPickup",
            "vehicle",
            "phones",
            "opens",
            "closes",
            "weeklyOff",
          ],
          content: (
            <>
              <FieldSet
                id="offersPickup"
                legend={t("kabadiwala.offersPickup")}
                error={errors.offersPickup?.message}
              >
                <Controller
                  control={control}
                  name="offersPickup"
                  render={({ field, fieldState }) => (
                    <YesNo
                      name="offersPickup"
                      isYes={field.value}
                      onChange={field.onChange}
                      invalid={Boolean(fieldState.error)}
                    />
                  )}
                />
                {values.offersPickup === false ? (
                  <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                    {t("kabadiwala.noPickupHint")}
                  </p>
                ) : null}
              </FieldSet>
              {values.offersPickup ? (
                <FieldSet
                  id="vehicle"
                  legend={t("kabadiwala.vehicle")}
                  error={errors.vehicle?.message}
                >
                  <Controller
                    control={control}
                    name="vehicle"
                    render={({ field, fieldState }) => (
                      <OptionCards
                        name="vehicle"
                        options={SHOP_VEHICLES.map((vehicle) => ({
                          value: vehicle,
                          label: t(`kabadiwala.vehicles.${vehicle}`),
                        }))}
                        value={field.value}
                        onChange={field.onChange}
                        invalid={Boolean(fieldState.error)}
                      />
                    )}
                  />
                </FieldSet>
              ) : null}

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
                legend={t("form.hours")}
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
          label={t("form.submit")}
          busyLabel={t("form.submitting")}
          isBusy={isSubmitting}
          failure={failure}
        />
      }
    />
  );
}
