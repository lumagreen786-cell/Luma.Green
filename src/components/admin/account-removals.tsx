"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { api } from "../../../convex/_generated/api";
import { adminErrorMessage } from "./convex-error";
import { formatWhen } from "./format";

type Removal = FunctionReturnType<
  typeof api.accountRemoval.reviewQueue
>[number];
const labels = {
  access_closed: "Access closed; cleanup queued",
  cleanup_running: "Cleanup in progress",
  restricted_review: "Retained-evidence review needed",
  review_recorded: "Retained-evidence review recorded",
};

export function AccountRemovals() {
  const queue = useQuery(api.accountRemoval.reviewQueue);
  return (
    <section className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">
          Account access and evidence review
        </h1>
        <p className="text-sm text-muted-foreground">
          Access is already closed. Review required retained evidence without
          changing payments, stock or handovers. Recording a review does not
          mean that all data was erased.
        </p>
      </header>
      <RemovalQueue queue={queue} />
    </section>
  );
}

function RemovalQueue({ queue }: { queue: Removal[] | undefined }) {
  if (queue === undefined) return <p role="status">Loading requests…</p>;
  if (queue.length === 0) return <p>No requests waiting for review.</p>;
  return (
    <div className="divide-y divide-border">
      {queue.map((request) => (
        <RemovalReview key={request.id} request={request} />
      ))}
    </div>
  );
}

function RemovalReview({ request }: { request: Removal }) {
  const recordReview = useMutation(api.accountRemoval.recordReview);
  const retryCleanup = useMutation(api.accountRemoval.retryCleanup);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const id = useId();
  async function perform(isRetry: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (isRetry) await retryCleanup({ requestId: request.id });
      else
        await recordReview({
          requestId: request.id,
          reference: reference.trim(),
        });
      setMessage(
        isRetry
          ? "Cleanup retry requested."
          : "Review recorded. Required evidence remains retained.",
      );
      if (!isRetry) setReference("");
    } catch (error_) {
      setError(
        adminErrorMessage(error_, {
          INVALID_REVIEW_REFERENCE:
            "Enter an external review reference of 8–200 characters.",
          REVIEW_NOT_READY:
            "This request is not ready for evidence review. Check its current state.",
          RETRY_NOT_READY: "This cleanup does not need another attempt.",
        }),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <article className="space-y-4 py-6">
      <header className="space-y-1">
        <h2 className="font-semibold">Request {request.id.slice(0, 12)}</h2>
        <p className="text-sm">{labels[request.state]}</p>
        <p className="text-xs text-muted-foreground">
          {formatWhen(request.createdAt)}
        </p>
      </header>
      {request.state === "restricted_review" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(false);
          }}
        >
          <Label htmlFor={id}>
            External retained-evidence review reference
          </Label>
          <Input
            id={id}
            value={reference}
            required
            minLength={8}
            maxLength={200}
            disabled={busy}
            onChange={(event) => {
              setReference(event.target.value);
            }}
            aria-describedby={`${id}-hint`}
          />
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            Use 8–200 characters. Link the review purpose and required evidence
            decision; do not enter customer contact details or claim all data
            was erased.
          </p>
          <Button type="submit" disabled={busy || reference.trim().length < 8}>
            Record review
          </Button>
        </form>
      ) : null}
      {request.state === "cleanup_running" && request.lastError ? (
        <div className="space-y-3">
          <p className="text-sm">
            Cleanup needs another attempt. Account access remains closed.
          </p>
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => {
              void perform(true);
            }}
          >
            Retry cleanup
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </article>
  );
}
