"use client";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { EvidenceDialog, LotField } from "@/components/lots/form-parts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, localeDirection } from "@/i18n/locales";
import { asciiDigits } from "@/lib/number-input";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { demandSchema } from "../../../convex/lib/ecosystem";
import {
  agreementSchema,
  planSchema,
  qualificationSchema,
  releaseSchema,
  sourcingReference,
} from "../../../convex/lib/sourcing";
export function whole(data: FormData, key: string) {
  const raw = asciiDigits(text(data, key)).trim();
  if (!/^\d+$/.test(raw)) throw new Error("INVALID_INPUT");
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error("INVALID_INPUT");
  return value;
}
const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};
export function Choice({
  label,
  name,
  value,
  onChange,
  items,
}: {
  label: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  const id = useId();
  const locale = useLocale();
  const t = useTranslations("sourcing");
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Select
        name={name}
        value={value}
        onValueChange={onChange}
        dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
      >
        <SelectTrigger id={id} className="min-h-11 w-full">
          <SelectValue placeholder={t("choose")} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function SourcingForm({
  title,
  hint,
  children,
  onSave,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  onSave: (data: FormData) => Promise<unknown>;
}) {
  const t = useTranslations("sourcing");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  // Dialog content unmounts on close; retain native text fields in memory.
  // Select choices already live in the owning form component state.
  const draft = useRef(new Map<string, string>());
  return (
    <EvidenceDialog
      title={title}
      hint={hint}
      open={open}
      onOpen={() => {
        setError(false);
        setOpen(true);
      }}
      onClose={() => {
        if (!pending) setOpen(false);
      }}
    >
      <form
        ref={(form) => {
          if (!form) return;
          for (const field of form.elements) {
            if (!(
              (field instanceof HTMLInputElement && field.type !== "hidden") ||
              field instanceof HTMLTextAreaElement
            )) {
              continue;
            }

            const value = draft.current.get(field.name);
            if (value !== undefined) field.value = value;
          }
        }}
        onInput={(event) => {
          const field = event.target;
          if (
            (field instanceof HTMLInputElement && field.type !== "hidden") ||
            field instanceof HTMLTextAreaElement
          ) {
            draft.current.set(field.name, field.value);
          }
        }}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          setPending(true);
          setError(false);
          void Promise.try(() => onSave(data))
            .then(() => {
              toast.success(t("saved"));
              draft.current.clear();
              setOpen(false);
            })
            .catch(() => {
              setError(true);
            })
            .finally(() => {
              setPending(false);
            });
        }}
      >
        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5">
          {children}
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {t("failed")}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
      </form>
    </EvidenceDialog>
  );
}
export function NewRecord({
  kind,
}: {
  kind: "demand" | "plan" | "qualification" | "agreement";
}) {
  const t = useTranslations("sourcing");
  const locale = useLocale();
  const [code, setCode] = useState("");
  const [supplier, setSupplier] = useState<Id<"orgs">>();
  const [decision, setDecision] = useState("");
  const [everyDays, setEveryDays] = useState("");
  const options = useQuery(api.sourcing.options, {
    materialCode: code || undefined,
  });
  const demand = useMutation(api.demand.post);
  const plan = useMutation(api.sourcing.postPlan);
  const qualification = useMutation(api.sourcing.recordQualification);
  const propose = useMutation(api.sourcing.propose);
  const isNeedsSupplier = kind === "qualification" || kind === "agreement";
  const title = {
    demand: "post",
    plan: "createPlan",
    qualification: "qualify",
    agreement: "propose",
  } as const;
  const hint = (
    {
      qualification: "privateDecision",
      agreement: "agreementHint",
      plan: "planHint",
      demand: "boundary",
    } as const
  )[kind];
  async function save(data: FormData) {
    if (isNeedsSupplier && !supplier) throw new Error("INVALID_INPUT");
    if (kind === "qualification" && supplier)
      return qualification({
        ...qualificationSchema.parse({
          sampleReference: text(data, "sampleReference"),
          specification: text(data, "specification"),
          decision: text(data, "decision"),
          validUntil: text(data, "validUntil"),
          reason: text(data, "reason"),
        }),
        supplierOrgId: supplier,
        materialCode: code,
      });
    if (kind === "agreement" && supplier)
      return propose({
        ...agreementSchema.parse({
          reference: text(data, "reference"),
          specification: text(data, "specification"),
          quantityGrams: whole(data, "quantityGrams"),
          paisePerKg: whole(data, "paisePerKg"),
          startsOn: text(data, "startsOn"),
          endsOn: text(data, "endsOn"),
        }),
        supplierOrgId: supplier,
        materialCode: code,
      });
    const fields = {
      materialCode: code,
      quantityGrams: whole(data, "quantityGrams"),
      area: text(data, "area"),
      specification: text(data, "specification"),
      neededBy: text(data, "neededBy"),
    };
    return kind === "plan"
      ? plan(
          planSchema.parse({ ...fields, everyDays: whole(data, "everyDays") }),
        )
      : demand(demandSchema.parse(fields));
  }
  return (
    <SourcingForm title={t(title[kind])} hint={t(hint)} onSave={save}>
      <Choice
        label={t("material")}
        value={code || undefined}
        onChange={(value) => {
          setCode(value);
          setSupplier(undefined);
        }}
        items={(options?.materials ?? []).map((m) => ({
          value: m.code,
          label: m.names[locale] || m.names.en || m.code,
        }))}
      />
      {isNeedsSupplier ? (
        <Choice
          label={t("supplier")}
          value={supplier}
          onChange={(value) => {
            const selected = options?.suppliers.find((s) => s.id === value);
            setSupplier(selected?.id);
          }}
          items={(options?.suppliers ?? []).map((s) => ({
            value: s.id,
            label: s.name,
          }))}
        />
      ) : null}
      {options?.truncated ? (
        <p className="text-sm text-muted-foreground">{t("limited")}</p>
      ) : null}
      <LotField
        name="specification"
        label={t("specification")}
        required
        minLength={3}
        maxLength={500}
      />
      {kind === "qualification" ? (
        <>
          <LotField
            name="sampleReference"
            label={t("sample")}
            required
            minLength={3}
            maxLength={120}
          />
          <Choice
            name="decision"
            value={decision}
            onChange={setDecision}
            label={t("decision")}
            items={(["pending", "approved", "rejected"] as const).map(
              (value) => ({ value, label: t(value) }),
            )}
          />
          <LotField
            name="validUntil"
            label={t("validUntil")}
            type="date"
            required
          />
          <LotField
            name="reason"
            label={t("reason")}
            required
            minLength={3}
            maxLength={500}
          />
        </>
      ) : (
        <>
          <LotField
            name="quantityGrams"
            label={t("quantity")}
            inputMode="numeric"
            required
          />
          {kind === "agreement" ? (
            <>
              <LotField
                name="reference"
                label={t("reference")}
                required
                minLength={3}
                maxLength={120}
              />
              <LotField
                name="paisePerKg"
                label={t("price")}
                inputMode="numeric"
                required
              />
              <LotField
                name="startsOn"
                label={t("startsOn")}
                type="date"
                required
              />
              <LotField
                name="endsOn"
                label={t("endsOn")}
                type="date"
                required
              />
            </>
          ) : (
            <>
              <LotField
                name="area"
                label={t("area")}
                required
                minLength={2}
                maxLength={100}
              />
              <LotField
                name="neededBy"
                label={t("neededBy")}
                type="date"
                required
              />
              {kind === "plan" ? (
                <Choice
                  name="everyDays"
                  value={everyDays}
                  onChange={setEveryDays}
                  label={t("cadence")}
                  items={[
                    { value: "7", label: t("weekly") },
                    { value: "30", label: t("monthly") },
                  ]}
                />
              ) : null}
            </>
          )}
        </>
      )}
    </SourcingForm>
  );
}
export function ReferenceAction({
  title,
  hint,
  onSave,
}: {
  title: string;
  hint: string;
  onSave: (reference: string) => Promise<unknown>;
}) {
  const t = useTranslations("sourcing");
  return (
    <SourcingForm
      title={title}
      hint={hint}
      onSave={(data) =>
        onSave(sourcingReference.parse(text(data, "reference")))
      }
    >
      <LotField
        name="reference"
        label={t("responseReference")}
        required
        minLength={3}
        maxLength={120}
      />
    </SourcingForm>
  );
}
export function ReleaseForm({
  agreementId,
}: {
  agreementId: Id<"sourcingAgreements">;
}) {
  const t = useTranslations("sourcing");
  const release = useMutation(api.sourcing.release);
  return (
    <SourcingForm
      title={t("release")}
      hint={t("releaseHint")}
      onSave={(data) =>
        release({
          agreementId,
          ...releaseSchema.parse({
            reference: text(data, "reference"),
            quantityGrams: whole(data, "quantityGrams"),
            neededBy: text(data, "neededBy"),
          }),
        })
      }
    >
      <LotField
        name="reference"
        label={t("reference")}
        required
        minLength={3}
        maxLength={120}
      />
      <LotField
        name="quantityGrams"
        label={t("quantity")}
        inputMode="numeric"
        required
      />
      <LotField name="neededBy" label={t("neededBy")} type="date" required />
    </SourcingForm>
  );
}

export function RescheduleForm({
  planId,
  expectedDate,
}: {
  planId: Id<"sourcingPlans">;
  expectedDate: string;
}) {
  const t = useTranslations("sourcing");
  const update = useMutation(api.sourcing.reschedule);
  return (
    <SourcingForm
      title={t("reschedule")}
      hint={t("rescheduleHint")}
      onSave={(data) =>
        update({ planId, expectedDate, neededBy: text(data, "neededBy") })
      }
    >
      <LotField name="neededBy" label={t("neededBy")} type="date" required />
    </SourcingForm>
  );
}
