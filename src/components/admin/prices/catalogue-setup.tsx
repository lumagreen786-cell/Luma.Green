"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { api } from "../../../../convex/_generated/api";
import { adminErrorMessage } from "../convex-error";

/** Safe setup on an empty backend; no prototype prices or operational data. */
export function CatalogueSetup() {
  const initialize = useMutation(api.catalogue.initializeDefinitions);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function addDefinitions() {
    setIsBusy(true);
    setStatus(null);
    setError(null);
    try {
      const { inserted } = await initialize({});
      setStatus(
        inserted === 0
          ? "All catalogue definitions are already present."
          : `Added ${String(inserted)} material definitions. Set the approved minimum and fallback prices next.`,
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
          Material catalogue setup
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Add missing material codes and translated names. Existing records are
          kept. Prices, emission factors, stock and certificates are not added.
          Material definitions do not approve waste handling or byproduct
          trading.
        </p>
      </header>
      <div className="flex flex-col items-start gap-3">
        <Button
          variant="outline"
          disabled={isBusy}
          onClick={() => {
            void addDefinitions();
          }}
        >
          {isBusy ? "Adding definitions…" : "Add catalogue definitions"}
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
