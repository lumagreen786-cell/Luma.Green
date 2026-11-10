"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { api } from "../../../../convex/_generated/api";
import type { SiteType } from "../../../../convex/lib/siteClassification";
import type { StakeholderKind } from "../../../../convex/lib/stakeholderKinds";
import messages from "../../../../messages/en.json";

type Request = FunctionReturnType<
  typeof api.stakeholderAccounts.pending
>[number];

const kindLabel: Record<StakeholderKind, string> = {
  participant_applicant: "Participant application",
  material_generator: "Non-household material generator",
  city_official: "City official",
  csr_sponsor: "CSR sponsor",
  lender: "Lender",
  independent_auditor: "Independent auditor",
  waste_picker_union: "Waste-picker union",
  apparel_brand: "Apparel brand",
  packaging_brand: "Packaging brand",
};

const siteLabel: Record<SiteType, string> = {
  apartment_community: "Apartment community",
  office: "Office",
  hotel: "Hotel",
  resort: "Resort",
  other: "Other premises",
  preprocessor_yard: "Preprocessor yard",
  recycling_facility: "Recycling facility",
  manufacturing_facility: "Manufacturing facility",
};

/** Pending identity requests only. Approval never grants operational access. */
export function StakeholderQueue() {
  const requests = useQuery(api.stakeholderAccounts.pending);
  return (
    <section
      aria-labelledby="stakeholder-requests"
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 border-t border-border pt-8"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="stakeholder-requests"
          className="font-display text-xl font-semibold tracking-tight"
        >
          Stakeholder account requests
        </h2>
        <p className="text-sm text-muted-foreground">
          Approval confirms an account identity only. It grants no trade or
          private-record access.
        </p>
      </div>
      {requests === undefined && <p role="status">Loading requests…</p>}
      {requests?.length === 0 && (
        <p className="border-y border-border py-5 text-sm text-muted-foreground">
          No stakeholder requests are waiting.
        </p>
      )}
      {requests && requests.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {requests.map((request) => (
            <li key={request.id} className="py-5">
              <ReviewRequest request={request} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewRequest({ request }: { request: Request }) {
  const decide = useMutation(api.stakeholderAccounts.decide);
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const isValid = note.trim().length >= 10 && note.trim().length <= 1000;

  async function submit(decision: "approve" | "reject") {
    if (!isValid || (decision === "approve" && !verified)) return;
    setBusy(true);
    try {
      await decide({ id: request.id, decision, reviewNote: note });
      toast.success(
        decision === "approve" ? "Account approved" : "Request rejected",
      );
    } catch {
      toast.error("Could not save the decision. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-8">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{request.organizationName}</h3>
        <p className="text-sm">
          {request.participantType
            ? messages.participantDirectory.roles[request.participantType]
            : kindLabel[request.kind]}
        </p>
        {request.siteType ? (
          <p className="text-sm text-muted-foreground">
            {siteLabel[request.siteType]}
          </p>
        ) : null}
        {request.applicantPhone ? (
          <p className="text-sm text-muted-foreground">
            {request.applicantPhone}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`stakeholder-note-${request.id}`}>
            Review note (10–1,000 characters)
          </Label>
          <Textarea
            id={`stakeholder-note-${request.id}`}
            value={note}
            maxLength={1000}
            rows={3}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id={`stakeholder-verified-${request.id}`}
            checked={verified}
            onCheckedChange={(checked) => {
              setVerified(checked === true);
            }}
          />
          <Label
            htmlFor={`stakeholder-verified-${request.id}`}
            className="font-normal"
          >
            I checked this applicant’s identity and affiliation.
          </Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!isValid || !verified || busy}
            onClick={() => {
              void submit("approve");
            }}
          >
            Approve account
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isValid || busy}
            onClick={() => {
              void submit("reject");
            }}
          >
            Reject request
          </Button>
        </div>
      </div>
    </div>
  );
}
