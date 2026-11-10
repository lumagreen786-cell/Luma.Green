"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { ListSkeleton } from "@/components/app/page-parts";
import { ActionButton } from "@/components/ui/action-button";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatPhone, formatWhen } from "../format";

const labels = {
  access: "Access personal data",
  correction: "Correct personal data",
  erasure: "Erase personal data",
  grievance: "Privacy grievance",
  nomination: "Nominate a representative",
  withdrawal: "Withdraw consent",
} as const;

export function PrivacyRequestQueue() {
  const rows = useQuery(api.privacyRequests.queue);
  const recordResponse = useMutation(api.privacyRequests.recordResponse);
  const [pending, setPending] = useState<Id<"privacyRequests">>();

  async function respond(id: Id<"privacyRequests">) {
    setPending(id);
    try {
      await recordResponse({ id });
    } catch {
      toast.error("Could not record the response. Try again.");
    } finally {
      setPending(undefined);
    }
  }

  return (
    <section
      aria-labelledby="privacy-queue"
      className="space-y-3 rounded-xl bg-card p-5 sm:p-6"
    >
      <h2 id="privacy-queue" className="text-xl font-semibold">
        Privacy requests
      </h2>
      <p className="text-sm text-muted-foreground">
        Verify the requester before sharing data or taking action. Record the
        response after you send the final reply through the verified channel.
      </p>
      {rows === undefined && <ListSkeleton rows={2} />}
      {rows?.length === 0 && <p>No open privacy requests.</p>}
      {rows && rows.length > 0 && (
        <ul className="divide-y border-y">
          {rows.map((row) => (
            <li key={row.id} className="space-y-2 py-4">
              <h3 className="font-medium">{labels[row.kind]}</h3>
              <p className="text-sm text-muted-foreground">
                Received {formatWhen(row.createdAt)}
              </p>
              <p className="text-sm break-all">Request {row.id}</p>
              <p className="text-sm break-all">Account {row.profileId}</p>
              <p className="text-sm">
                {row.phone
                  ? formatPhone(row.phone)
                  : "Use the verified privacy contact channel."}
              </p>
              <ActionButton
                label="Record response"
                isDisabled={pending !== undefined}
                onClick={() => {
                  void respond(row.id);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
