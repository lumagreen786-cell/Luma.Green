"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { api } from "../../../../convex/_generated/api";
import { adminErrorMessage } from "../convex-error";
import { formatWhen } from "../format";

const schema = z.object({
  hazardStatus: z
    .enum(["", "non_hazardous", "hazardous"])
    .refine((value) => value !== "", "Choose a classification."),
  sourceReference: z
    .string()
    .trim()
    .min(3, "Enter at least 3 characters.")
    .max(160, "Use no more than 160 characters."),
});
type Material = FunctionReturnType<
  typeof api.byproductClassification.list
>[number];

export function MaterialClassification() {
  const rows = useQuery(api.byproductClassification.list, {});
  const [code, setCode] = useState("");
  const id = useId();
  const selected = rows?.find((row) => row.code === code);
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 flex-col gap-4 rounded-xl bg-card p-5 sm:p-6"
    >
      <header className="flex flex-col gap-1.5">
        <h2
          id={`${id}-heading`}
          className="font-display text-lg font-semibold tracking-tight"
        >
          Material classification
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Review an active scrap category before manufacturer byproduct offers.
          This platform review does not certify a facility, shipment or legal
          approval. Do not infer safety from a workbook sector or CPCB colour.
        </p>
      </header>
      {rows === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading material classifications…
        </p>
      ) : null}
      {rows?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add catalogue definitions to review active scrap materials.
        </p>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-material`}>Material to review</Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger id={`${id}-material`} className="h-11 w-full">
                <SelectValue placeholder="Choose a material" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((row) => (
                  <SelectItem key={row.code} value={row.code}>
                    {row.name} · {row.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected ? (
            <ReviewForm key={selected.code} material={selected} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ReviewForm({ material }: { material: Material }) {
  const reviewMaterial = useMutation(
    api.byproductClassification.reviewMaterial,
  );
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const id = useId();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { sourceReference: "", hazardStatus: "" },
  });
  async function save(values: z.infer<typeof schema>) {
    setSaved(false);
    setFailure(null);
    try {
      await reviewMaterial({
        materialCode: material.code,
        ...values,
        hazardStatus: values.hazardStatus,
      });
      reset({ sourceReference: "", hazardStatus: "" });
      setSaved(true);
    } catch (error) {
      const message = adminErrorMessage(error, {
        MATERIAL_NOT_ELIGIBLE:
          "This material is no longer an active scrap category. Choose another material.",
        INVALID_CLASSIFICATION_SOURCE:
          "Enter a review rationale or evidence reference of 3 to 160 characters.",
      });
      setFailure(message);
      toast.error(message);
    }
  }
  const reviewLabel = material.review
    ? { hazardous: "Hazardous", non_hazardous: "Non-hazardous" }[
        material.review.hazardStatus
      ]
    : "Not reviewed";
  const referenceDescription = errors.sourceReference
    ? `${id}-reference-help ${id}-reference-error`
    : `${id}-reference-help`;
  return (
    <form
      noValidate
      aria-label={`Classification for ${material.name}`}
      onSubmit={(event) => {
        void handleSubmit(save)(event);
      }}
      className="flex flex-col gap-4"
    >
      <div className="space-y-1 text-sm">
        <p className="font-medium">Current review: {reviewLabel}</p>
        {material.review ? (
          <>
            <p className="break-words text-muted-foreground">
              Reference: {material.review.sourceReference}
            </p>
            <p className="text-muted-foreground">
              Reviewed {formatWhen(material.review.reviewedAt)}
            </p>
          </>
        ) : null}
      </div>
      <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-classification`}>New classification</Label>
          <Controller
            name="hazardStatus"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id={`${id}-classification`}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  aria-invalid={Boolean(errors.hazardStatus)}
                  aria-describedby={
                    errors.hazardStatus
                      ? `${id}-classification-error`
                      : undefined
                  }
                  className="h-11 w-full"
                >
                  <SelectValue placeholder="Choose a classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="non_hazardous">Non-hazardous</SelectItem>
                  <SelectItem value="hazardous">Hazardous</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.hazardStatus ? (
            <p
              id={`${id}-classification-error`}
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.hazardStatus.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-reference`}>
            Review rationale / evidence reference
          </Label>
          <Input
            id={`${id}-reference`}
            {...register("sourceReference")}
            maxLength={160}
            aria-invalid={Boolean(errors.sourceReference)}
            aria-describedby={referenceDescription}
          />
          <p
            id={`${id}-reference-help`}
            className="text-sm text-muted-foreground"
          >
            Use 3–160 characters. Record the basis for this decision. This
            reference is kept in the audit history.
          </p>
          {errors.sourceReference ? (
            <p
              id={`${id}-reference-error`}
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.sourceReference.message}
            </p>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Hazardous classification blocks ordinary offers. Non-hazardous
          classification still requires the other material, organisation and
          trade checks. Saving replaces the current review and retains the
          previous decision in the audit log.
        </p>
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Saving review…" : "Save classification"}
        </Button>
      </fieldset>
      {saved ? (
        <p role="status" className="text-sm">
          Classification saved. The audit log records this review.
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      ) : null}
    </form>
  );
}
