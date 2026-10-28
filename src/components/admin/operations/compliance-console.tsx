"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { api } from "../../../../convex/_generated/api";
import { PROCESS_KINDS } from "../../../../convex/lib/industrialClassification";
import { AdminChoice, AdminField } from "./definition-console";
import { IndiaRegulatoryReferences } from "./india-regulatory-references";
const reviewSchema = z.object({
  materialCodes: z.string().trim().min(1).max(1800),
  evidenceReference: z.string().trim().min(3).max(500),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const destinationSchema = reviewSchema
  .omit({ evidenceReference: true })
  .extend({
    name: z.string().trim().min(1).max(120),
    siteReference: z.string().trim().min(3).max(500),
    authorisationReference: z.string().trim().min(3).max(500),
  });
type Process = (typeof PROCESS_KINDS)[number];
function ProcessChoices({
  values,
  onChange,
  available = PROCESS_KINDS,
}: {
  values: Process[];
  onChange: (value: Process[]) => void;
  available?: readonly Process[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">Reviewed processes</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {available.map((p) => (
          <Label className="flex min-h-11 items-center gap-2" key={p}>
            <Checkbox
              checked={values.includes(p)}
              onCheckedChange={(checked) => {
                onChange(
                  checked === true
                    ? [...values, p]
                    : values.filter((x) => x !== p),
                );
              }}
            />
            {p.replaceAll("_", " ")}
          </Label>
        ))}
      </div>
    </fieldset>
  );
}
export function FacilityReviewConsole() {
  const data = useQuery(api.complianceReview.queue, {});
  const save = useMutation(api.complianceReview.reviewFacility);
  const [facilityId, setFacility] = useState("");
  const [registrationId, setRegistration] = useState("");
  const [decision, setDecision] = useState<
    "approved" | "rejected" | "revoked" | ""
  >("");
  const [processes, setProcesses] = useState<Process[]>([]);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const form = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { materialCodes: "", evidenceReference: "", validUntil: "" },
  });
  const facility = data?.facilities.find((f) => f.id === facilityId);
  return (
    <div className="space-y-6">
      <details>
        <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Find India regulatory references
        </summary>
        <IndiaRegulatoryReferences />
      </details>
      <p className="text-sm text-muted-foreground">
        Review the actual registration, material and process scope. This records
        your evidence review; it does not issue a consent or submit to a
        regulator. A later facility edit, registration correction, expiry or
        revocation invalidates current approval.
      </p>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(async (values) => {
            setFailed(false);
            setSaved(false);
            const registration = facility?.registrations.find(
              (r) => r.id === registrationId,
            );
            if (
              !facility ||
              !registration ||
              !decision ||
              processes.length === 0
            ) {
              setFailed(true);
              return;
            }
            try {
              await save({
                ...values,
                facilityId: facility.id,
                registrationId: registration.id,
                decision,
                processes,
                materialCodes: values.materialCodes
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              form.reset();
              setSaved(true);
            } catch {
              setFailed(true);
            }
          })(e);
        }}
      >
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          <AdminChoice
            label="Facility to review"
            value={facilityId}
            onChange={(value) => {
              setFacility(value);
              setRegistration("");
              setProcesses([]);
            }}
            options={
              data?.facilities.map((f) => ({
                value: f.id,
                label: `${f.organisation} · ${f.name}`,
              })) ?? []
            }
          />
          <AdminChoice
            label="Registration evidence"
            value={registrationId}
            onChange={setRegistration}
            options={
              facility?.registrations.map((r) => ({
                value: r.id,
                label: `${r.reference} · ${r.validUntil}${r.current ? "" : " · not current"}`,
              })) ?? []
            }
          />
          <AdminChoice
            label="Review decision"
            value={decision}
            onChange={(value) => {
              const parsed = z
                .enum(["approved", "rejected", "revoked"])
                .safeParse(value);
              if (parsed.success) setDecision(parsed.data);
            }}
            options={[
              { value: "approved", label: "Approved evidence scope" },
              { value: "rejected", label: "Rejected" },
              { value: "revoked", label: "Revoked" },
            ]}
          />
          <AdminField
            label="Material codes, separated by commas"
            registration={form.register("materialCodes")}
          />
          <ProcessChoices
            values={processes}
            onChange={setProcesses}
            available={facility?.capabilities ?? []}
          />
          <AdminField
            label="Evidence and review reference"
            registration={form.register("evidenceReference")}
          />
          <AdminField
            label="Review valid until"
            type="date"
            registration={form.register("validUntil")}
          />
          <Button type="submit">Record scope review</Button>
        </fieldset>
      </form>
      {failed || Object.keys(form.formState.errors).length > 0 ? (
        <p role="alert">
          Could not save. Check the current registration, explicit scope, expiry
          and your access.
        </p>
      ) : null}
      {saved ? <p role="status">Scope review recorded.</p> : null}
      {data?.truncated ? (
        <p>Showing the most recently updated 100 facilities.</p>
      ) : null}
      <ul className="divide-y border-y">
        {data?.facilities.map((f) => (
          <li key={f.id} className="space-y-3 py-4">
            <h2 className="font-semibold">
              {f.organisation} · {f.name}
            </h2>
            {f.reviews.map((r) => (
              <div key={r.id} className="space-y-1 border-s ps-3 text-sm">
                <p>
                  {r.decision} · {r.current ? "Current" : "Not current"} ·{" "}
                  {r.validUntil}
                </p>
                <p className="break-words">{r.materialCodes.join(", ")}</p>
                <p className="break-words">{r.evidenceReference}</p>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
export function DestinationConsole() {
  const rows = useQuery(api.complianceReview.destinations, { admin: true });
  const create = useMutation(api.complianceReview.recordDestination);
  const change = useMutation(api.complianceReview.changeDestinationStatus);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof destinationSchema>>({
    resolver: zodResolver(destinationSchema),
    defaultValues: {
      name: "",
      siteReference: "",
      materialCodes: "",
      authorisationReference: "",
      validUntil: "",
    },
  });
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Record a destination only after checking its authorisation and exact
        material/process scope. This directory cannot prove a collection,
        treatment, disposal or portal action. Correct source details with a new
        entry and deactivate the old one.
      </p>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(async (values) => {
            setFailed(false);
            setSaved(false);
            try {
              await create({
                ...values,
                processes,
                materialCodes: values.materialCodes
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              form.reset();
              setProcesses([]);
              setSaved(true);
            } catch {
              setFailed(true);
            }
          })(e);
        }}
      >
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          {(
            [
              ["name", "Destination name"],
              ["siteReference", "Site / address reference"],
              ["materialCodes", "Material codes, separated by commas"],
              ["authorisationReference", "Reviewed authorisation reference"],
            ] as const
          ).map(([key, label]) => (
            <AdminField
              key={key}
              label={label}
              registration={form.register(key)}
            />
          ))}
          <AdminField
            label="Authorisation valid until"
            type="date"
            registration={form.register("validUntil")}
          />
          <ProcessChoices values={processes} onChange={setProcesses} />
          <Button type="submit">Record reviewed destination</Button>
        </fieldset>
      </form>
      {failed || Object.keys(form.formState.errors).length > 0 ? (
        <p role="alert">
          Could not save. Check required scope, dates, evidence and your access.
        </p>
      ) : null}
      {saved ? <p role="status">Destination record saved.</p> : null}
      <div className="max-w-xl space-y-2">
        <Label htmlFor="destination-status-reason">Status change reason</Label>
        <Input
          id="destination-status-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
          maxLength={500}
        />
      </div>
      <ul className="divide-y border-y">
        {rows?.map((d) => (
          <li key={d.id} className="space-y-2 py-4">
            <h2 className="font-semibold">{d.name}</h2>
            <p className="break-words">{d.siteReference}</p>
            <p>
              {d.effective ? "Current" : "Not current"} · {d.validUntil}
            </p>
            <p className="text-sm break-words">
              {d.materialCodes.join(", ")} · {d.authorisationReference}
            </p>
            <Button
              variant="outline"
              disabled={busy || reason.trim().length < 3}
              onClick={() => {
                setBusy(true);
                setFailed(false);
                void change({ id: d.id, active: !d.active, reason })
                  .then(() => {
                    setSaved(true);
                    setReason("");
                  })
                  .catch(() => {
                    setFailed(true);
                  })
                  .finally(() => {
                    setBusy(false);
                  });
              }}
            >
              {d.active ? "Deactivate destination" : "Reactivate destination"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
