"use client";

import { useMutation } from "convex/react";
import { BadgeCheckIcon, FilePenLineIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ApplicationKind } from "../../../../convex/lib/onboarding";
import {
  checkNote,
  type Decision,
  NOTE_MAX_CHARS,
  NOTE_MIN_CHARS,
} from "../../../../convex/lib/review";
import { adminErrorMessage } from "../convex-error";

export interface DecisionSubject {
  id: Id<"applications">;
  name: string;
  kind: ApplicationKind;
}

const DECISION_ERRORS: Readonly<Record<string, string>> = {
  WRONG_STATE:
    "This application has already been decided, or was sent again. Go back to the queue to see where it stands.",
  NOTE_REQUIRED: `Write a note of at least ${String(NOTE_MIN_CHARS)} characters: the applicant reads it.`,
  NOTE_TOO_LONG: `Keep the note under ${String(NOTE_MAX_CHARS)} characters.`,
  INCOMPLETE_APPLICATION:
    "Part of this application is missing, so it can't open a business. Ask for changes instead.",
  NOT_FOUND: "This application isn't there any more.",
};

interface DecisionCopy {
  title: string;
  description: string;
  noteLabel?: string;
  placeholder?: string;
  confirm: string;
  busy: string;
  done: string;
  variant: "default" | "destructive";
}

function approvalOutcome(kind: ApplicationKind): string {
  if (kind === "saathi") {
    return "They become a Saathi and can start taking jobs near them.";
  }
  return kind === "kabadiwala"
    ? "Their shop opens on Luma.Green, starting with today's fallback prices, which they can change from their app."
    : "Their business opens on Luma.Green, ready to buy and sell on the market.";
}

/** What each decision's dialog says, and the toast once it's done. */
export function decisionCopy(
  decision: Decision,
  subject: Pick<DecisionSubject, "name" | "kind">,
): DecisionCopy {
  switch (decision) {
    case "approve": {
      return {
        title: `Approve ${subject.name}?`,
        description: approvalOutcome(subject.kind),
        confirm: "Approve",
        busy: "Approving…",
        done: `${subject.name} is approved. Their dashboard is open.`,
        variant: "default",
      };
    }
    case "changes": {
      return {
        title: `Ask ${subject.name} for changes`,
        description:
          "The application goes back to them with your note, and comes back to the queue when they send it again.",
        noteLabel: "What should they change?",
        placeholder:
          "For example: the consent certificate is blurred. Please upload a clear photo or the PDF.",
        confirm: "Send back for changes",
        busy: "Sending…",
        done: `Sent back to ${subject.name} with your note.`,
        variant: "default",
      };
    }
    case "reject": {
      return {
        title: `Reject ${subject.name}?`,
        description:
          "This closes the application. They can apply again only after talking to us.",
        noteLabel: "Why are you rejecting it?",
        placeholder:
          "For example: the consent number isn't on the KSPCB register.",
        confirm: "Reject application",
        busy: "Rejecting…",
        done: `${subject.name} was rejected.`,
        variant: "destructive",
      };
    }
  }
}

/** Approve, ask for changes, or reject. Approve waits for the checklist. */
export function DecisionPanel({
  subject,
  canApprove,
  onDecided,
}: {
  subject: DecisionSubject;
  canApprove: boolean;
  onDecided?: () => void;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  return (
    <section className="flex min-w-0 flex-col gap-4 border-t border-border pt-6">
      <header className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Decision
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The applicant sees it on their status screen.
        </p>
      </header>
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          className="min-h-12"
          disabled={!canApprove}
          onClick={() => {
            setDecision("approve");
          }}
        >
          <BadgeCheckIcon aria-hidden />
          Approve
        </Button>
        {canApprove ? null : (
          <p className="text-xs text-muted-foreground">
            Tick every check above to approve.
          </p>
        )}
        <Button
          size="lg"
          variant="outline"
          className="min-h-12"
          onClick={() => {
            setDecision("changes");
          }}
        >
          <FilePenLineIcon aria-hidden />
          Ask for changes
        </Button>
        <Button
          size="lg"
          variant="destructive"
          className="min-h-12"
          onClick={() => {
            setDecision("reject");
          }}
        >
          <XCircleIcon aria-hidden />
          Reject
        </Button>
      </div>
      {decision ? (
        <DecisionDialog
          key={decision}
          decision={decision}
          subject={subject}
          onDecided={onDecided}
          onClose={() => {
            setDecision(null);
          }}
        />
      ) : null}
    </section>
  );
}

function DecisionDialog({
  decision,
  subject,
  onClose,
  onDecided,
}: {
  decision: Decision;
  subject: DecisionSubject;
  onClose: () => void;
  onDecided?: () => void;
}) {
  const decide = useMutation(api.review.decide);
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const copy = decisionCopy(decision, subject);

  async function submit() {
    const checked = checkNote(decision, note);
    if (!checked.ok) {
      setError(DECISION_ERRORS[checked.error] ?? null);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await decide({
        applicationId: subject.id,
        decision,
        note: checked.note,
      });
      toast.success(copy.done);
      if (onDecided) {
        onClose();
        onDecided();
      } else router.push("/admin/verification");
    } catch (error_) {
      setError(adminErrorMessage(error_, DECISION_ERRORS));
      setIsBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          {copy.noteLabel ? (
            <div className="flex flex-col gap-3">
              <Label htmlFor="decision-note">{copy.noteLabel}</Label>
              <Textarea
                id="decision-note"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
                rows={5}
                maxLength={NOTE_MAX_CHARS}
                placeholder={copy.placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby="decision-note-help"
              />
              <p
                id="decision-note-help"
                className="flex justify-between gap-2 text-xs text-muted-foreground"
              >
                <span>The applicant reads this, so be clear and kind.</span>
                <span className="tabular-nums">
                  {note.length}/{NOTE_MAX_CHARS}
                </span>
              </p>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isBusy}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant={copy.variant} disabled={isBusy}>
              {isBusy ? copy.busy : copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
