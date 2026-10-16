"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FactoryIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { useWorkspace } from "@/components/app/use-workspace";
import { WorkflowTabs } from "@/components/app/workflow-tabs";
import { EvidenceDialog, LotField, Mass } from "@/components/lots/form-parts";
import { formIndex, parseGrams } from "@/components/lots/logic";
import { NotForYou } from "@/components/shop/guards";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, localeDirection } from "@/i18n/locales";

import { api } from "../../../convex/_generated/api";

const label = z.string().trim().min(1).max(120);
const reference = z.string().trim().min(3).max(500);
const ingredientSchema = z.object({
  name: label,
  basisPoints: z.string().refine((x) => {
    const n = parseGrams(x);
    return n !== null && n > 0 && n <= 10_000;
  }),
  additive: z.boolean(),
});
const inputSchema = z.object({
  lotId: z.string(),
  grams: z.number(),
  recycledGrams: z.string().refine((x) => parseGrams(x) !== null),
  evidenceReference: reference,
  additive: z.boolean(),
});
const recipeSchema = z.object({
  reference: label,
  version: label,
  name: label,
  instructions: reference,
  ingredients: z.array(ingredientSchema).min(1).max(20),
});
const batchSchema = z.object({
  reference: label,
  evidenceReference: reference,
  inputs: z.array(inputSchema).min(1).max(20),
});
type Data = FunctionReturnType<typeof api.production.mine>;
export function ProductionPage() {
  const w = useWorkspace();
  const t = useTranslations("operations");
  if (w === undefined) return <ListSkeleton />;
  if (w?.kind !== "org")
    return (
      <NotForYou
        title={t("production")}
        heading={t("production")}
        body={t("workspaceRequired")}
        icon={FactoryIcon}
      />
    );
  return (
    <ProductionWorkspace
      key={`${w.org.id}:${w.role}`}
      canOperate={w.role !== "viewer"}
    />
  );
}
function ProductionWorkspace({ canOperate }: { canOperate: boolean }) {
  const t = useTranslations("operations");
  const fmt = useFormatter();
  const data = useQuery(api.production.mine, {});
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AppPageHeader title={t("production")} lead={t("productionHint")} />
      <WorkflowTabs
        items={[
          {
            value: "recipes",
            label: t("recipes"),
            content: (
              <div className="space-y-5">
                {canOperate ? <RecipeForm /> : null}
                {data === undefined ? (
                  <ListSkeleton />
                ) : (
                  <ul className="divide-y border-y">
                    {data.recipes.map((r) => (
                      <li key={r.id} className="space-y-3 py-4">
                        <h2 className="font-display text-lg font-semibold">
                          {r.name} · {r.version}
                        </h2>
                        <p className="break-words">{r.reference}</p>
                        <details className="border-s-2 ps-4">
                          <summary className="cursor-pointer py-2 font-medium">
                            {t("ingredients")}
                          </summary>
                          <ul className="space-y-2">
                            {r.ingredients.map((i) => (
                              <li key={i.name}>
                                {i.name} ·{" "}
                                {fmt.number(i.basisPoints / 10_000, {
                                  style: "percent",
                                  maximumFractionDigits: 2,
                                })}
                                {i.additive ? ` · ${t("additive")}` : ""}
                              </li>
                            ))}
                          </ul>
                          <p className="text-sm break-words whitespace-pre-wrap">
                            {r.instructions}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
                {data?.recipes.length === 0 ? <p>{t("empty")}</p> : null}
              </div>
            ),
          },
          {
            value: "batches",
            label: t("batches"),
            content: (
              <div className="space-y-5">
                {canOperate && data ? <BatchForm data={data} /> : null}
                {data === undefined ? (
                  <ListSkeleton />
                ) : (
                  <ul className="divide-y border-y">
                    {data.batches.map((b) => (
                      <li key={b.id} className="space-y-3 py-4">
                        <h2 className="font-display text-lg font-semibold">
                          {b.reference}
                        </h2>
                        <dl className="space-y-2 text-sm">
                          <div>
                            <dt className="text-muted-foreground">
                              {t("recipe")}
                            </dt>
                            <dd>
                              {b.recipeName ?? t("empty")} · {b.recipeVersion}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              {t("transformation")}
                            </dt>
                            <dd>
                              {b.transformationCreatedAt === null
                                ? t("empty")
                                : fmt.dateTime(b.transformationCreatedAt, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              {t("inspection")}
                            </dt>
                            <dd>{b.inspectionReference ?? t("empty")}</dd>
                          </div>
                        </dl>
                        <p>
                          {t("inputTotal")}: <Mass grams={b.inputGrams} /> ·{" "}
                          {t("outputTotal")}: <Mass grams={b.outputGrams} />
                        </p>
                        <p>
                          {t("inputFraction")}:{" "}
                          {fmt.number(b.recycledInputBasisPoints / 10_000, {
                            style: "percent",
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-sm break-words">
                          {b.evidenceReference}
                        </p>
                        <details className="border-s-2 ps-4">
                          <summary className="cursor-pointer py-2 font-medium">
                            {t("inputEvidence")}
                          </summary>
                          <ul className="space-y-2">
                            {b.inputs.map((i) => (
                              <li key={i.lotId} className="text-sm break-words">
                                {t("recycledGrams")}:{" "}
                                {fmt.number(i.recycledGrams)} /{" "}
                                {fmt.number(i.grams)} · {i.evidenceReference}
                                {i.additive ? ` · ${t("additive")}` : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
                {data?.batches.length === 0 ? <p>{t("empty")}</p> : null}
              </div>
            ),
          },
        ]}
      />
      {data?.truncated ? <p>{t("truncated")}</p> : null}
    </div>
  );
}
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  const locale = useLocale();
  const t = useTranslations("operations");
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
        value={value}
        onValueChange={onChange}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={t("choose")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem value={o.value} key={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function RecipeForm() {
  const t = useTranslations("operations");
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const create = useMutation(api.production.recordRecipe);
  const form = useForm<z.infer<typeof recipeSchema>>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      reference: "",
      version: "",
      name: "",
      instructions: "",
      ingredients: [{ name: "", basisPoints: "10000", additive: false }],
    },
  });
  const ingredients = useFieldArray({
    control: form.control,
    name: "ingredients",
  });
  const watchedIngredients = useWatch({
    control: form.control,
    name: "ingredients",
  });
  return (
    <EvidenceDialog
      title={t("newRecipe")}
      hint={t("recipeHint")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        if (!form.formState.isSubmitting) setOpen(false);
      }}
    >
      <form
        onSubmit={(e) => {
          void form.handleSubmit(async (values) => {
            setFailed(false);
            setInvalid(false);
            const rows = values.ingredients.map((i) => ({
              ...i,
              basisPoints: parseGrams(i.basisPoints) ?? 0,
            }));
            if (rows.reduce((n, i) => n + i.basisPoints, 0) !== 10_000) {
              setInvalid(true);
              return;
            }
            try {
              await create({ ...values, ingredients: rows });
              form.reset();
              setOpen(false);
            } catch {
              setFailed(true);
            }
          })(e);
        }}
      >
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["reference", "version", "name", "instructions"] as const).map(
              (key) => (
                <div
                  key={key}
                  className={
                    key === "name" || key === "instructions"
                      ? "sm:col-span-2"
                      : "min-w-0"
                  }
                >
                  <LotField
                    label={t(key)}
                    registration={form.register(key)}
                    invalid={form.getFieldState(key, form.formState).invalid}
                  />
                </div>
              ),
            )}
          </div>
          <h3 className="font-semibold">{t("ingredients")}</h3>
          {ingredients.fields.map((item, index) => (
            <div
              key={item.id}
              className="grid items-end gap-3 border-b pb-4 sm:grid-cols-2"
            >
              <LotField
                label={t("ingredient")}
                registration={form.register(
                  `ingredients.${formIndex(index)}.name`,
                )}
                invalid={Boolean(
                  form.formState.errors.ingredients?.[index]?.name,
                )}
              />
              <LotField
                label={t("basisPoints")}
                inputMode="numeric"
                registration={form.register(
                  `ingredients.${formIndex(index)}.basisPoints`,
                )}
                invalid={Boolean(
                  form.formState.errors.ingredients?.[index]?.basisPoints,
                )}
              />
              <Label className="flex min-h-11 items-center gap-2">
                <Checkbox
                  checked={watchedIngredients[index]?.additive ?? false}
                  onCheckedChange={(value) => {
                    form.setValue(
                      `ingredients.${formIndex(index)}.additive`,
                      value === true,
                    );
                  }}
                />
                {t("additive")}
              </Label>
              {ingredients.fields.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    ingredients.remove(index);
                  }}
                >
                  {t("remove")}
                </Button>
              ) : null}
            </div>
          ))}
          {ingredients.fields.length < 20 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                ingredients.append({
                  name: "",
                  basisPoints: "",
                  additive: false,
                });
              }}
            >
              {t("addIngredient")}
            </Button>
          ) : null}
          {invalid || Object.keys(form.formState.errors).length > 0 ? (
            <p role="alert">{t("invalid")}</p>
          ) : null}
          {failed ? <p role="alert">{t("failed")}</p> : null}
          <Button type="submit">{t("save")}</Button>
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}
function BatchForm({ data }: { data: Data }) {
  const lots = useTranslations("lots");
  const t = useTranslations("operations");
  const fmt = useFormatter();
  const [open, setOpen] = useState(false);
  const [recipeId, setRecipe] = useState("");
  const [transformationId, setTransformation] = useState("");
  const [inspectionId, setInspection] = useState("");
  const [failed, setFailed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const create = useMutation(api.production.declareBatch);
  const transformation = data.transformations.find(
    (x) => x.id === transformationId,
  );
  const form = useForm<z.infer<typeof batchSchema>>({
    resolver: zodResolver(batchSchema),
    defaultValues: { reference: "", evidenceReference: "", inputs: [] },
  });
  const watchedInputs = useWatch({ control: form.control, name: "inputs" });
  return (
    <EvidenceDialog
      title={t("newBatch")}
      hint={t("batchHint")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        if (!form.formState.isSubmitting) setOpen(false);
      }}
    >
      <form
        onSubmit={(e) => {
          void form.handleSubmit(async (values) => {
            setInvalid(false);
            setFailed(false);
            const recipe = data.recipes.find((x) => x.id === recipeId);
            const inspection = transformation?.inspections.find(
              (x) => x.id === inspectionId,
            );
            if (!recipe || !transformation || !inspection) {
              setInvalid(true);
              return;
            }
            const inputs = values.inputs.map((i) => {
              const source = transformation.inputs.find(
                (x) => x.lotId === i.lotId,
              );
              return source
                ? {
                    ...i,
                    lotId: source.lotId,
                    recycledGrams: parseGrams(i.recycledGrams) ?? 0,
                  }
                : null;
            });
            if (inputs.some((x) => x === null || x.recycledGrams > x.grams)) {
              setInvalid(true);
              return;
            }
            try {
              await create({
                ...values,
                recipeId: recipe.id,
                transformationId: transformation.id,
                inspectionId: inspection.id,
                inputs: inputs.filter((x) => x !== null),
              });
              form.reset();
              setOpen(false);
            } catch {
              setFailed(true);
            }
          })(e);
        }}
      >
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          <LotField
            label={t("reference")}
            registration={form.register("reference")}
            invalid={Boolean(form.formState.errors.reference)}
          />
          <Choice
            label={t("recipe")}
            value={recipeId}
            onChange={setRecipe}
            options={data.recipes.map((r) => ({
              value: r.id,
              label: `${r.name} · ${r.version}`,
            }))}
          />
          <Choice
            label={t("transformation")}
            value={transformationId}
            onChange={(value) => {
              setTransformation(value);
              setInspection("");
              const selected = data.transformations.find((x) => x.id === value);
              form.setValue(
                "inputs",
                selected?.inputs.map((i) => ({
                  ...i,
                  recycledGrams: "0",
                  evidenceReference: "",
                  additive: false,
                })) ?? [],
              );
            }}
            options={data.transformations.map((r) => ({
              value: r.id,
              label: `${fmt.dateTime(r.createdAt)} · ${lots("grams", { value: fmt.number(r.inputGrams) })}`,
            }))}
          />
          <Choice
            label={t("inspection")}
            value={inspectionId}
            onChange={setInspection}
            options={
              transformation?.inspections.map((r) => ({
                value: r.id,
                label: r.reference,
              })) ?? []
            }
          />
          {transformation?.inputs.map((input, index) => (
            <div
              key={input.lotId}
              className="grid items-end gap-3 border-b pb-4 sm:grid-cols-2"
            >
              <p>
                {input.materialCode} · <Mass grams={input.grams} />
              </p>
              <LotField
                label={t("recycledGrams")}
                inputMode="numeric"
                registration={form.register(
                  `inputs.${formIndex(index)}.recycledGrams`,
                )}
                invalid={Boolean(
                  form.formState.errors.inputs?.[index]?.recycledGrams,
                )}
              />
              <LotField
                label={t("inputEvidence")}
                registration={form.register(
                  `inputs.${formIndex(index)}.evidenceReference`,
                )}
                invalid={Boolean(
                  form.formState.errors.inputs?.[index]?.evidenceReference,
                )}
              />
              <Label className="flex min-h-11 items-center gap-2">
                <Checkbox
                  checked={watchedInputs[index]?.additive ?? false}
                  onCheckedChange={(v) => {
                    form.setValue(
                      `inputs.${formIndex(index)}.additive`,
                      v === true,
                    );
                  }}
                />
                {t("additive")}
              </Label>
            </div>
          ))}
          <LotField
            label={t("batchEvidence")}
            registration={form.register("evidenceReference")}
            invalid={Boolean(form.formState.errors.evidenceReference)}
          />
          {invalid || Object.keys(form.formState.errors).length > 0 ? (
            <p role="alert">{t("invalid")}</p>
          ) : null}
          {failed ? <p role="alert">{t("failed")}</p> : null}
          <Button type="submit">{t("save")}</Button>
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}
