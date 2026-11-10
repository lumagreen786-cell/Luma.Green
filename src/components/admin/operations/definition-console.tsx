"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useId, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";

import { api } from "../../../../convex/_generated/api";

export function AdminField({
  label,
  registration,
  type = "text",
  long = false,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  type?: string;
  long?: boolean;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {long ? (
        <Textarea id={id} {...registration} />
      ) : (
        <Input id={id} type={type} {...registration} />
      )}
    </div>
  );
}
export function AdminChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select" />
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
const schema = z.object({
  materialCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,59}$/),
  name: z.string().trim().min(1).max(120),
  processingState: z.string().trim().min(1).max(120),
  grade: z.string().trim().min(1).max(120),
  version: z.string().trim().min(1).max(120),
  specification: z.string().trim().min(1).max(2000),
  sourceReference: z.string().trim().min(1).max(500),
});
export function DefinitionConsole() {
  const rows = useQuery(api.operationalCatalogue.adminList, {});
  const draft = useMutation(api.operationalCatalogue.draft);
  const review = useMutation(api.operationalCatalogue.review);
  const [family, setFamily] = useState<
    "plastic" | "paper" | "metal" | "glass" | "ewaste" | "other"
  >("plastic");
  const [stage, setStage] = useState<"scrap" | "recycled">("scrap");
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  const [reviewReference, setReviewReference] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      materialCode: "",
      name: "",
      processingState: "",
      grade: "",
      version: "",
      specification: "",
      sourceReference: "",
    },
  });
  return (
    <div className="space-y-6 rounded-xl bg-card p-5 sm:p-6">
      <p className="text-sm text-muted-foreground">
        Review source evidence before activation. An active definition does not
        approve hazard handling, quality, emissions or regulatory scope.
        Existing material family and stage cannot be changed here.
      </p>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(async (values) => {
            setError(false);
            setNotice("");
            try {
              await draft({ ...values, family, stage });
              form.reset();
              setNotice("Draft recorded. Review it before activation.");
            } catch {
              setError(true);
            }
          })(e);
        }}
      >
        <fieldset
          disabled={form.formState.isSubmitting}
          className="grid gap-4 sm:grid-cols-2"
        >
          {(
            [
              ["materialCode", "Material code"],
              ["name", "Material name"],
              ["processingState", "Processing state"],
              ["grade", "Grade"],
              ["version", "Definition version"],
              ["sourceReference", "Source evidence reference"],
            ] as const
          ).map(([key, label]) => (
            <AdminField
              key={key}
              label={label}
              registration={form.register(key)}
            />
          ))}
          <AdminChoice
            label="Material family"
            value={family}
            onChange={(value) => {
              const parsed = z
                .enum(["plastic", "paper", "metal", "glass", "ewaste", "other"])
                .safeParse(value);
              if (parsed.success) setFamily(parsed.data);
            }}
            options={[
              "plastic",
              "paper",
              "metal",
              "glass",
              "ewaste",
              "other",
            ].map((value) => ({ value, label: value }))}
          />
          <AdminChoice
            label="Commercial stage"
            value={stage}
            onChange={(value) => {
              if (value === "scrap" || value === "recycled") setStage(value);
            }}
            options={[
              { value: "scrap", label: "Scrap" },
              { value: "recycled", label: "Recycled" },
            ]}
          />
          <div className="sm:col-span-2">
            <AdminField
              long
              label="Written quality specification and units"
              registration={form.register("specification")}
            />
          </div>
          <Button type="submit">Record draft</Button>
        </fieldset>
      </form>
      {Object.keys(form.formState.errors).length > 0 ? (
        <p role="alert">Check the required fields and material code.</p>
      ) : null}
      {error ? (
        <p role="alert">
          The change could not be saved. Check the record state, version and
          your access, then retry.
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <div className="max-w-xl space-y-2">
        <Label htmlFor="definition-review-reference">
          Review evidence reference
        </Label>
        <Input
          id="definition-review-reference"
          value={reviewReference}
          maxLength={500}
          onChange={(e) => {
            setReviewReference(e.target.value);
          }}
        />
      </div>
      <ul className="divide-y border-y">
        {rows?.map((row) => (
          <li className="space-y-3 py-4" key={row.id}>
            <h2 className="font-semibold">
              {row.name} · {row.grade}
            </h2>
            <p className="text-sm break-words">
              {row.materialCode} · {row.processingState} · {row.version} ·{" "}
              {row.status}
            </p>
            <p className="text-sm break-words whitespace-pre-wrap">
              {row.specification}
            </p>
            <p className="text-sm break-words text-muted-foreground">
              {row.sourceReference}
            </p>
            <div className="flex flex-wrap gap-2">
              {row.status === "retired"
                ? null
                : [
                    ...(row.status === "draft" ? ["active" as const] : []),
                    "retired" as const,
                  ].map((decision) => (
                    <Button
                      key={decision}
                      variant={decision === "active" ? "default" : "outline"}
                      disabled={busy || !reviewReference.trim()}
                      onClick={() => {
                        setBusy(true);
                        setError(false);
                        void review({
                          id: row.id,
                          decision,
                          reference: reviewReference,
                        })
                          .then(() => {
                            setNotice("Review recorded.");
                            setReviewReference("");
                          })
                          .catch(() => {
                            setError(true);
                          })
                          .finally(() => {
                            setBusy(false);
                          });
                      }}
                    >
                      {decision === "active"
                        ? "Activate definition"
                        : "Retire definition"}
                    </Button>
                  ))}
            </div>
          </li>
        ))}
      </ul>
      {rows?.length === 0 ? (
        <p>No definitions yet. Start with a reviewed material specification.</p>
      ) : null}
    </div>
  );
}
