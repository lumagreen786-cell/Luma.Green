"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { ReviewedDestinationPicker } from "@/components/operations/reviewed-destination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCanOperate } from "@/components/workspace/permissions";
import { useRouter } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  type PROCESS_KINDS,
  requiresControlledRoute,
} from "../../../convex/lib/industrialClassification";
import { AdditionalInputFields } from "./additional-input-fields";
import {
  ClassificationFields,
  FacilityProcessFields,
} from "./classification-fields";
import {
  BusinessPicker,
  EvidenceDialog,
  FormStatus,
  LotField,
  Mass,
  useEvidenceAction,
} from "./form-parts";
import {
  accountedGrams,
  combinedInputGrams,
  declareSchema,
  dispositionSchema,
  formIndex,
  parseGrams,
  transformSchema,
} from "./logic";

export function DeclareLot() {
  const t = useTranslations("lots");
  const costs = useTranslations("recordedCosts");
  const canOperate = useCanOperate();
  const create = useMutation(api.traceability.declareLot);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = useEvidenceAction();
  const form = useForm<z.infer<typeof declareSchema>>({
    resolver: zodResolver(declareSchema),
    defaultValues: {
      materialCode: "",
      state: "",
      grams: "",
      sourceReference: "",
      acquisitionCostPaise: "",
      costReference: "",
      streamClass: "unspecified",
      handlingClass: "unassessed",
    },
  });
  const [streamClass, handlingClass] = useWatch({
    control: form.control,
    name: ["streamClass", "handlingClass"],
  });
  if (!canOperate) return null;
  const invalidCostMessage = form.formState.errors.acquisitionCostPaise
    ? costs("hint")
    : undefined;
  return (
    <EvidenceDialog
      title={t("declare")}
      hint={t("evidenceNote")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          void form.handleSubmit(async (values) => {
            await action.run(async () => {
              const id = await create({
                ...values,
                grams: parseGrams(values.grams) ?? 0,
                sourceReference: values.sourceReference || undefined,
                acquisitionCostPaise: values.acquisitionCostPaise?.trim()
                  ? parseGrams(values.acquisitionCostPaise)
                  : undefined,
                costReference: values.costReference?.trim()
                  ? values.costReference
                  : undefined,
              });
              form.reset();
              setOpen(false);
              router.push(`/app/lots/${id}`);
            });
          })(event);
        }}
      >
        <fieldset
          disabled={form.formState.isSubmitting}
          className="flex flex-col gap-4"
        >
          <LotField
            label={t("material")}
            maxLength={120}
            registration={form.register("materialCode")}
            invalid={Boolean(form.formState.errors.materialCode)}
          />
          <LotField
            label={t("state")}
            maxLength={120}
            registration={form.register("state")}
            invalid={Boolean(form.formState.errors.state)}
          />
          <LotField
            label={t("mass")}
            inputMode="numeric"
            registration={form.register("grams")}
            invalid={Boolean(form.formState.errors.grams)}
          />
          <p className="text-sm text-muted-foreground">{t("integerHint")}</p>
          <LotField
            label={t("sourceReference")}
            maxLength={500}
            registration={form.register("sourceReference")}
            invalid={Boolean(form.formState.errors.sourceReference)}
          />
          <LotField
            label={costs("acquisition")}
            inputMode="numeric"
            registration={form.register("acquisitionCostPaise")}
            invalid={Boolean(form.formState.errors.acquisitionCostPaise)}
          />
          <LotField
            label={costs("reference")}
            maxLength={500}
            registration={form.register("costReference")}
            invalid={Boolean(form.formState.errors.costReference)}
          />
          <p className="text-sm text-muted-foreground">{costs("hint")}</p>
          <ClassificationFields
            streamClass={streamClass}
            handlingClass={handlingClass}
            onStream={(value) => {
              form.setValue("streamClass", value);
            }}
            onHandling={(value) => {
              form.setValue("handlingClass", value);
            }}
          />
          <FormStatus
            busy={form.formState.isSubmitting}
            invalid={Object.keys(form.formState.errors).length > 0}
            failure={action.failure}
            invalidMessage={
              form.formState.errors.costReference
                ? t("required")
                : invalidCostMessage
            }
          />
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}

export function TransformLot({
  lotId,
  availableGrams,
}: {
  lotId: Id<"materialLots">;
  availableGrams: number;
}) {
  const t = useTranslations("lots");
  const costs = useTranslations("recordedCosts");
  const format = useFormatter();
  const canOperate = useCanOperate();
  const transform = useMutation(api.traceability.transform);
  const [open, setOpen] = useState(false);
  const action = useEvidenceAction();
  const [operationReference, setOperationReference] = useState(() =>
    crypto.randomUUID(),
  );
  const [facilityId, setFacilityId] = useState<Id<"industrialFacilities">>();
  const [processKind, setProcessKind] =
    useState<(typeof PROCESS_KINDS)[number]>();
  const form = useForm<z.infer<typeof transformSchema>>({
    resolver: zodResolver(transformSchema),
    defaultValues: {
      inputGrams: "",
      additionalInputs: [],
      contaminationGrams: "0",
      processLossGrams: "0",
      processingCostPaise: "",
      costReference: "",
      outputs: [
        {
          materialCode: "",
          state: "",
          grams: "",
          streamClass: "unspecified",
          handlingClass: "unassessed",
        },
      ],
    },
  });
  const sourceLots = useQuery(api.traceability.mine, open ? {} : "skip");
  const outputs = useFieldArray({ control: form.control, name: "outputs" });
  const [contaminationGrams, processLossGrams, watchedOutputs] = useWatch({
    control: form.control,
    name: ["contaminationGrams", "processLossGrams", "outputs"],
  });
  if (!canOperate) return null;
  const invalidCostMessage = form.formState.errors.processingCostPaise
    ? costs("hint")
    : undefined;
  const accounted = accountedGrams({
    inputGrams: "",
    contaminationGrams,
    processLossGrams,
    outputs: watchedOutputs,
  });
  return (
    <EvidenceDialog
      title={t("transform")}
      hint={t("transformHint")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          void form.handleSubmit(async (values) => {
            const inputGrams = parseGrams(values.inputGrams) ?? 0;
            const combined = combinedInputGrams(values);
            if (combined === null || accountedGrams(values) !== combined) {
              action.setFailure("balanceError");
              return;
            }
            if (inputGrams > availableGrams) {
              action.setFailure("invalidInput");
              return;
            }
            if (Boolean(facilityId) !== Boolean(processKind)) {
              action.setFailure("invalidInput");
              return;
            }
            const additionalInputs: {
              lotId: Id<"materialLots">;
              grams: number;
            }[] = [];
            const allocations = values.additionalInputs ?? [];
            for (const input of allocations) {
              const held = sourceLots?.rows.find(
                (row) =>
                  row.id === input.lotId &&
                  row.id !== lotId &&
                  row.status === "available" &&
                  !requiresControlledRoute(row),
              );
              const grams = parseGrams(input.grams) ?? 0;
              if (!held || grams > held.availableGrams) {
                action.setFailure("invalidInput");
                return;
              }
              additionalInputs.push({ lotId: held.id, grams });
            }
            await action.run(
              () =>
                transform({
                  inputLotId: lotId,
                  additionalInputs:
                    additionalInputs.length > 0 ? additionalInputs : undefined,
                  facilityId,
                  processKind,
                  inputGrams,
                  contaminationGrams:
                    parseGrams(values.contaminationGrams) ?? 0,
                  processLossGrams: parseGrams(values.processLossGrams) ?? 0,
                  processingCostPaise: values.processingCostPaise?.trim()
                    ? parseGrams(values.processingCostPaise)
                    : undefined,
                  costReference: values.costReference?.trim()
                    ? values.costReference
                    : undefined,
                  operationReference,
                  outputs: values.outputs.map((row) => ({
                    ...row,
                    grams: parseGrams(row.grams) ?? 0,
                  })),
                }),
              () => {
                form.reset();
                setFacilityId(undefined);
                setProcessKind(undefined);
                setOperationReference(crypto.randomUUID());
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
          <p>
            {t("remaining")}: <Mass grams={availableGrams} />
          </p>
          {open ? (
            <FacilityProcessFields
              facilityId={facilityId}
              processKind={processKind}
              onChange={(id, kind) => {
                setFacilityId(id);
                setProcessKind(kind);
              }}
            />
          ) : null}
          <LotField
            label={t("inputMass")}
            inputMode="numeric"
            registration={form.register("inputGrams")}
            invalid={Boolean(form.formState.errors.inputGrams)}
          />
          <p className="text-sm text-muted-foreground">{t("integerHint")}</p>
          {open ? (
            <AdditionalInputFields
              form={form}
              lotId={lotId}
              sourceLots={sourceLots}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <LotField
              label={t("contamination")}
              inputMode="numeric"
              registration={form.register("contaminationGrams")}
              invalid={Boolean(form.formState.errors.contaminationGrams)}
            />
            <LotField
              label={t("processLoss")}
              inputMode="numeric"
              registration={form.register("processLossGrams")}
              invalid={Boolean(form.formState.errors.processLossGrams)}
            />
          </div>
          <LotField
            label={costs("processing")}
            inputMode="numeric"
            registration={form.register("processingCostPaise")}
            invalid={Boolean(form.formState.errors.processingCostPaise)}
          />
          <LotField
            label={costs("reference")}
            maxLength={500}
            registration={form.register("costReference")}
            invalid={Boolean(form.formState.errors.costReference)}
          />
          <p className="text-sm text-muted-foreground">{costs("hint")}</p>
          <p className="text-sm text-muted-foreground">{costs("loss")}</p>
          <h3 className="font-medium">{t("outputs")}</h3>
          {outputs.fields.map((field, index) => (
            <fieldset
              key={field.id}
              className="flex flex-col gap-3 border-t pt-4"
            >
              <legend className="text-sm font-medium">
                {t("outputNumber", { number: index + 1 })}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <LotField
                  label={t("material")}
                  maxLength={120}
                  registration={form.register(
                    `outputs.${formIndex(index)}.materialCode`,
                  )}
                  invalid={Boolean(
                    form.formState.errors.outputs?.[index]?.materialCode,
                  )}
                />
                <LotField
                  label={t("state")}
                  maxLength={120}
                  registration={form.register(
                    `outputs.${formIndex(index)}.state`,
                  )}
                  invalid={Boolean(
                    form.formState.errors.outputs?.[index]?.state,
                  )}
                />
              </div>
              <LotField
                label={t("mass")}
                inputMode="numeric"
                registration={form.register(
                  `outputs.${formIndex(index)}.grams`,
                )}
                invalid={Boolean(form.formState.errors.outputs?.[index]?.grams)}
              />
              <ClassificationFields
                streamClass={watchedOutputs[index]?.streamClass}
                handlingClass={watchedOutputs[index]?.handlingClass}
                onStream={(value) => {
                  form.setValue(
                    `outputs.${formIndex(index)}.streamClass`,
                    value,
                  );
                }}
                onHandling={(value) => {
                  form.setValue(
                    `outputs.${formIndex(index)}.handlingClass`,
                    value,
                  );
                }}
              />
              {outputs.fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-fit"
                  onClick={() => {
                    outputs.remove(index);
                  }}
                >
                  {t("remove")}
                </Button>
              ) : null}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit"
            disabled={outputs.fields.length >= 10}
            onClick={() => {
              outputs.append({
                materialCode: "",
                state: "",
                grams: "",
                streamClass: "unspecified",
                handlingClass: "unassessed",
              });
            }}
          >
            {t("addOutput")}
          </Button>
          {accounted === null ? null : (
            <p role="status">
              {t("balance", {
                value: t("grams", { value: format.number(accounted) }),
              })}
            </p>
          )}
          <FormStatus
            busy={form.formState.isSubmitting}
            invalid={Object.keys(form.formState.errors).length > 0}
            failure={action.failure}
            invalidMessage={
              form.formState.errors.costReference
                ? t("required")
                : invalidCostMessage
            }
          />
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}

export function DispatchLot({
  lotId,
  grams,
  city,
}: {
  lotId: Id<"materialLots">;
  grams: number;
  city: string;
}) {
  const t = useTranslations("lots");
  const canOperate = useCanOperate();
  const dispatch = useMutation(api.traceability.dispatch);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receiver, setReceiver] = useState<Id<"orgs">>();
  const action = useEvidenceAction();
  if (!canOperate) return null;
  return (
    <EvidenceDialog
      title={t("dispatch")}
      hint={t("dispatchHint")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!receiver) {
            action.setFailure("invalidInput");
            return;
          }
          setBusy(true);
          void action
            .run(
              () => dispatch({ lotId, receiverOrgId: receiver }),
              () => {
                setOpen(false);
              },
            )
            .finally(() => {
              setBusy(false);
            });
        }}
      >
        <fieldset disabled={busy} className="flex flex-col gap-4">
          <p>
            {t("remaining")}: <Mass grams={grams} />
          </p>
          <BusinessPicker
            city={city}
            value={receiver}
            onChange={setReceiver}
            label={t("receiver")}
          />
          <FormStatus busy={busy} failure={action.failure} />
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}

export function ReceiveLot({
  lotId,
  grams,
}: {
  lotId: Id<"materialLots">;
  grams: number;
}) {
  const t = useTranslations("lots");
  const canOperate = useCanOperate();
  const receive = useMutation(api.traceability.receive);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [weight, setWeight] = useState("");
  const action = useEvidenceAction();
  if (!canOperate) return null;
  return (
    <EvidenceDialog
      title={t("receive")}
      hint={t("receiveHint")}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const receivedGrams = parseGrams(weight);
          if (!receivedGrams) {
            action.setFailure("invalidInput");
            return;
          }
          if (receivedGrams !== grams) {
            action.setFailure("weightDispute");
            return;
          }
          setBusy(true);
          void action
            .run(
              () => receive({ lotId, receivedGrams }),
              () => {
                setOpen(false);
                setWeight("");
              },
            )
            .finally(() => {
              setBusy(false);
            });
        }}
      >
        <fieldset disabled={busy} className="flex flex-col gap-4">
          <p>
            {t("dispatched")}: <Mass grams={grams} />
          </p>
          <LotField
            label={t("receivedMass")}
            inputMode="numeric"
            value={weight}
            onChange={(event) => {
              setWeight(event.target.value);
            }}
          />
          <p className="text-sm text-muted-foreground">{t("integerHint")}</p>
          <FormStatus busy={busy} failure={action.failure} />
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}

export function RecordDisposition({
  lotId,
  availableGrams,
  materialCode,
}: {
  lotId: Id<"materialLots">;
  availableGrams: number;
  materialCode: string;
}) {
  const t = useTranslations("lots");
  const operations = useTranslations("operations");
  const [useReviewed, setUseReviewed] = useState(false);
  const [reviewedDestinationId, setReviewedDestinationId] =
    useState<Id<"controlledDestinations">>();
  const canOperate = useCanOperate();
  const record = useMutation(api.traceability.recordControlledDisposition);
  const [open, setOpen] = useState(false);
  const action = useEvidenceAction();
  const form = useForm<z.infer<typeof dispositionSchema>>({
    resolver: zodResolver(dispositionSchema),
    defaultValues: {
      grams: "",
      destinationReference: "",
      authorisationReference: "",
      manifestReference: "",
    },
  });
  if (!canOperate) return null;
  return (
    <EvidenceDialog
      title={t("recordDisposition")}
      hint={t("dispositionHint")}
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
            const grams = parseGrams(values.grams) ?? 0;
            if (
              grams > availableGrams ||
              (useReviewed && !reviewedDestinationId)
            ) {
              action.setFailure("invalidInput");
              return;
            }
            await action.run(
              () =>
                record({
                  ...values,
                  lotId,
                  grams,
                  reviewedDestinationId: useReviewed
                    ? reviewedDestinationId
                    : undefined,
                }),
              () => {
                form.reset();
                setUseReviewed(false);
                setReviewedDestinationId(undefined);
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
          <p>
            {t("remaining")}: <Mass grams={availableGrams} />
          </p>
          <LotField
            label={t("mass")}
            inputMode="numeric"
            registration={form.register("grams")}
            invalid={Boolean(form.formState.errors.grams)}
          />
          <p className="text-sm text-muted-foreground">{t("integerHint")}</p>
          <Label className="flex min-h-11 items-center gap-2">
            <Checkbox
              checked={useReviewed}
              onCheckedChange={(value) => {
                setUseReviewed(value === true);
                setReviewedDestinationId(undefined);
              }}
            />
            {operations("destinations")}
          </Label>
          {useReviewed ? (
            <ReviewedDestinationPicker
              materialCode={materialCode}
              value={reviewedDestinationId ?? ""}
              onSelect={(destination) => {
                setReviewedDestinationId(destination.id);
                form.setValue(
                  "destinationReference",
                  `${destination.name} · ${destination.siteReference}`,
                );
                form.setValue(
                  "authorisationReference",
                  destination.authorisationReference,
                );
              }}
            />
          ) : null}
          {(
            [
              "destinationReference",
              "authorisationReference",
              "manifestReference",
            ] as const
          ).map((key) => (
            <LotField
              key={key}
              label={t(key)}
              readOnly={useReviewed && key !== "manifestReference"}
              maxLength={500}
              registration={form.register(key)}
              invalid={Object.keys(form.formState.errors).includes(key)}
            />
          ))}
          <FormStatus
            busy={form.formState.isSubmitting}
            invalid={Object.keys(form.formState.errors).length > 0}
            failure={action.failure}
          />
        </fieldset>
      </form>
    </EvidenceDialog>
  );
}
