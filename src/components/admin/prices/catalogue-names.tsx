"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { api } from "../../../../convex/_generated/api";
import { adminErrorMessage } from "../convex-error";

/** Fill missing translations after a catalogue update, preserving existing names. */
export function CatalogueNames() {
  const fillMissingNames = useMutation(api.catalogue.fillMissingNames);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function updateNames() {
    setIsBusy(true);
    setStatus(null);
    setError(null);
    try {
      const { updated } = await fillMissingNames({});
      setStatus(
        updated === 0
          ? "All material names are already present."
          : `Added missing names to ${String(updated)} materials.`,
      );
    } catch (error_) {
      const message = adminErrorMessage(error_, {});
      setError(message);
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <section className="flex min-w-0 flex-col gap-4 border-t border-border pt-6">
      <header className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Material translations
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Add missing material names from the current catalogue. Existing names
          and all prices are kept.
        </p>
      </header>
      <div className="flex flex-col items-start gap-3">
        <Button
          variant="outline"
          disabled={isBusy}
          onClick={() => {
            void updateNames();
          }}
        >
          {isBusy ? "Adding names…" : "Add missing names"}
        </Button>
        {status ? (
          <p role="status" className="text-sm">
            {status}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
