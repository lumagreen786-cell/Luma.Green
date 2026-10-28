"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useFormat } from "@/components/app/format";
import { RecordedCost } from "@/components/lots/cost-parts";
import { EvidenceDialog, LotField, Mass } from "@/components/lots/form-parts";
import { parseGrams } from "@/components/lots/logic";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCanOperate } from "@/components/workspace/permissions";
import { isLocale, localeDirection } from "@/i18n/locales";

import { api } from "../../../convex/_generated/api";

const schema = z
  .object({
    intakeReference: z.string().trim().min(1).max(120),
    materialCode: z.string().min(1),
    grams: z.string().refine((value) => (parseGrams(value) ?? 0) > 0),
    producedOn: z.iso.date(),
    sourceReference: z.string().trim().min(1).max(500),
    weighingReference: z.string().trim().min(1).max(500),
    recordedCostPaise: z
      .string()
      .refine((value) => value.trim() === "" || parseGrams(value) !== null)
      .optional(),
    costReference: z
      .string()
      .trim()
      .max(500)
      .refine((value) => value === "" || value.length >= 3)
      .optional(),
    ownProductionConfirmed: z.boolean().refine((value) => value),
  })
  .refine(
    (value) =>
      !value.recordedCostPaise?.trim() ||
      Boolean(value.costReference && value.costReference.length >= 3),
    { path: ["costReference"] },
  );

export function StockIntake() {
  const t = useTranslations("stockIntake");
  const costs = useTranslations("recordedCosts");
  const common = useTranslations("common");
  const canOperate = useCanOperate();
  const format = useFormatter();
  const { results, status, loadMore } = usePaginatedQuery(
    api.stockIntake.mine,
    {},
    { initialNumItems: 20 },
  );
  return (
    <section
      className="flex min-w-0 flex-col gap-4 border-t pt-6"
      aria-label={t("title")}
    >
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{t("lead")}</p>
      {canOperate ? <IntakeForm /> : null}
      <p className="max-w-3xl text-sm text-muted-foreground">{t("note")}</p>
      <h3 className="font-medium">{t("history")}</h3>
      {status === "LoadingFirstPage" ? (
        <p role="status">{common("loading")}</p>
      ) : null}
      {status !== "LoadingFirstPage" && results.length === 0 ? (
        <p>{t("empty")}</p>
      ) : null}
      <ol className="divide-y">
        {results.map((row) => (
          <li key={row.id} className="space-y-2 py-4">
            <div className="flex flex-wrap justify-between gap-3">
              <h4 className="font-medium break-words">{row.intakeReference}</h4>
              <Mass grams={row.grams} />
            </div>
            <p className="break-words">{row.materialCode}</p>
            <p className="text-sm">
              <span className="text-muted-foreground">{costs("total")}: </span>
              <RecordedCost paise={row.recordedCostPaise} />
            </p>
            {row.costReference ? (
              <p className="text-sm break-words">
                {costs("reference")}: {row.costReference}
              </p>
            ) : null}
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t("date")}</dt>
                <dd>
                  <time dateTime={row.producedOn}>
                    {format.dateTime(new Date(`${row.producedOn}T00:00:00Z`), {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })}
                  </time>
                </dd>
              </div>
              {(["sourceReference", "weighingReference"] as const).map(
                (key) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-muted-foreground">
                      {t(key === "sourceReference" ? "source" : "weighing")}
                    </dt>
                    <dd className="break-words">{row[key]}</dd>
                  </div>
                ),
              )}
            </dl>
          </li>
        ))}
      </ol>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={status === "LoadingMore"}
          onClick={() => {
            loadMore(20);
          }}
        >
          {status === "LoadingMore" ? common("loading") : t("more")}
        </Button>
      ) : null}
    </section>
  );
}
function IntakeForm() {
  const t = useTranslations("stockIntake");
  const costs = useTranslations("recordedCosts");
  const lots = useTranslations("lots");
  const common = useTranslations("common");
  const format = useFormat();
  const locale = useLocale();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<"conflict" | "error" | null>(null);
  const choices = useQuery(api.stockIntake.materials, open ? {} : "skip");
  const save = useMutation(api.stockIntake.record);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      intakeReference: "",
      materialCode: "",
      grams: "",
      producedOn: "",
      sourceReference: "",
      weighingReference: "",
      recordedCostPaise: "",
      costReference: "",
      ownProductionConfirmed: false,
    },
  });
  const [materialCode, confirmed] = useWatch({
    control: form.control,
    name: ["materialCode", "ownProductionConfirmed"],
  });
  return (
    <EvidenceDialog
      title={t("add")}
      hint={t("lead")}
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
            setFailure(null);
            try {
              await save({
                ...values,
                grams: parseGrams(values.grams) ?? 0,
                recordedCostPaise: values.recordedCostPaise?.trim()
                  ? parseGrams(values.recordedCostPaise)
                  : undefined,
                costReference: values.costReference?.trim()
                  ? values.costReference
                  : undefined,
                ownProductionConfirmed: true,
              });
              form.reset();
              setOpen(false);
              toast.success(lots("saved"));
            } catch (error) {
              const isConflict =
                error instanceof ConvexError &&
                error.data === "INTAKE_REFERENCE_CONFLICT";
              setFailure(isConflict ? "conflict" : "error");
              toast.error(isConflict ? t("conflict") : common("error"));
            }
          })(event);
        }}
      >
        <fieldset
          disabled={form.formState.isSubmitting}
          className="flex min-w-0 flex-col gap-4"
        >
          <LotField
            label={t("reference")}
            maxLength={120}
            registration={form.register("intakeReference")}
            invalid={Boolean(form.formState.errors.intakeReference)}
          />
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor={`${id}-material`}>{lots("material")}</label>
            <Select
              value={materialCode}
              dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
              onValueChange={(value) => {
                if (choices?.some((row) => row.code === value))
                  form.setValue("materialCode", value);
              }}
            >
              <SelectTrigger id={`${id}-material`} className="min-h-11 w-full">
                <SelectValue placeholder={lots("material")} />
              </SelectTrigger>
              <SelectContent>
                {choices?.map((row) => (
                  <SelectItem value={row.code} key={row.code}>
                    {format.material(row.names, row.code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {choices?.length === 0 ? (
            <p role="status">{t("noMaterials")}</p>
          ) : null}
          <LotField
            label={lots("mass")}
            inputMode="numeric"
            registration={form.register("grams")}
            invalid={Boolean(form.formState.errors.grams)}
          />
          <p className="text-sm text-muted-foreground">{lots("integerHint")}</p>
          <LotField
            label={t("date")}
            type="date"
            registration={form.register("producedOn")}
            invalid={Boolean(form.formState.errors.producedOn)}
          />
          <LotField
            label={t("source")}
            maxLength={500}
            registration={form.register("sourceReference")}
            invalid={Boolean(form.formState.errors.sourceReference)}
          />
          <LotField
            label={t("weighing")}
            maxLength={500}
            registration={form.register("weighingReference")}
            invalid={Boolean(form.formState.errors.weighingReference)}
          />
          <fieldset className="flex min-w-0 flex-col gap-3 border-t pt-4">
            <legend className="font-medium">{costs("total")}</legend>
            <LotField
              label={costs("acquisition")}
              inputMode="numeric"
              registration={form.register("recordedCostPaise")}
              invalid={Boolean(form.formState.errors.recordedCostPaise)}
            />
            <LotField
              label={costs("reference")}
              maxLength={500}
              registration={form.register("costReference")}
              invalid={Boolean(form.formState.errors.costReference)}
            />
            <p className="text-sm text-muted-foreground">{costs("hint")}</p>
          </fieldset>
          <label
            htmlFor={`${id}-confirmed`}
            className="flex min-h-11 items-start gap-3 text-sm"
          >
            <Checkbox
              id={`${id}-confirmed`}
              className="mt-1"
              checked={confirmed}
              onCheckedChange={(value) => {
                form.setValue("ownProductionConfirmed", value === true);
              }}
            />
            <span>{t("confirm")}</span>
          </label>
          {failure || Object.keys(form.formState.errors).length > 0 ? (
            <p role="alert" className="text-sm text-destructive">
              {failure === "conflict" ? t("conflict") : common("error")}
            </p>
          ) : null}
          <Button
            type="submit"
            className="self-start"
            disabled={form.formState.isSubmitting || choices?.length === 0}
          >
            {lots(form.formState.isSubmitting ? "saving" : "save")}
          </Button>
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}
