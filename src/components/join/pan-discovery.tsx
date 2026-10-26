"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FormField } from "./fields";

interface Discovery {
  pan: string;
  registrations: {
    gstin: string;
    state: string;
    stateCode: string;
    status: string;
  }[];
}
type Failure = "limit" | "pending" | "required" | "unavailable" | "saveFailed";
function failureFrom(error: unknown): Failure {
  if (!(error instanceof ConvexError)) return "unavailable";
  if (error.data === "CHECK_LIMIT") return "limit";
  if (error.data === "CHECK_PENDING") return "pending";
  return error.data === "VALIDATION_REQUIRED" ? "required" : "unavailable";
}
/** Explicit lookup and selection precede the separate GST business-detail confirmation. */
export function PanDiscovery({
  applicationId,
  pan,
  gstin,
  onPan,
  onSelected,
  save,
}: {
  applicationId: Id<"applications">;
  pan?: string;
  gstin?: string;
  onPan: (pan: string) => void;
  onSelected: (gstin: string) => void;
  save: () => Promise<unknown>;
}) {
  const t = useTranslations("join.discovery");
  const statusCopy = useTranslations("join.identity");
  const lookup = useAction(api.identityDiscovery.lookup);
  const select = useMutation(api.identityDiscovery.select);
  const cached = useQuery(api.identityDiscovery.current, { applicationId });
  const [found, setFound] = useState<Discovery>();
  const [failure, setFailure] = useState<{ pan: string; status: Failure }>();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const key = pan?.trim().toUpperCase() ?? "";
  const latest = useRef(key);
  useEffect(() => {
    latest.current = key;
  }, [key]);
  const restored = cached?.pan === key ? cached : undefined;
  const result = found?.pan === key ? found : restored;
  async function find() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFailure(undefined);
    let isSaved = false;
    try {
      await save();
      isSaved = true;
      const response = await lookup({ applicationId, consent: true });
      if (latest.current === key && response.pan === key) setFound(response);
    } catch (error) {
      setFailure({
        pan: key,
        status: isSaved ? failureFrom(error) : "saveFailed",
      });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function choose(value: string) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFailure(undefined);
    try {
      await save();
      await select({ applicationId, gstin: value });
      if (latest.current === key) onSelected(value);
    } catch (error) {
      setFailure({ pan: key, status: failureFrom(error) });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function selectionLabel(row: { gstin: string; status: string }) {
    if (row.status !== "Active") return t("inactive");
    return t(gstin === row.gstin ? "selected" : "select");
  }
  return (
    <section className="space-y-4" aria-label={t("title")}>
      <FormField id="discovery-pan" label={statusCopy("pan")}>
        <Input
          id="discovery-pan"
          dir="ltr"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={10}
          value={pan ?? ""}
          onChange={(event) => {
            setFound(undefined);
            latest.current = event.target.value.trim().toUpperCase();
            onPan(event.target.value.toUpperCase());
          }}
          className="h-12 font-mono text-base uppercase"
        />
      </FormField>
      <p className="text-sm text-muted-foreground">{t("consent")}</p>
      <ActionButton
        type="button"
        label={busy ? statusCopy("checking") : t("find")}
        isDisabled={busy || !/^[A-Z]{5}\d{4}[A-Z]$/u.test(key)}
        onClick={() => {
          void find();
        }}
      />
      {result ? (
        <section aria-label={t("title")} className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("detailsHint")}</p>
          {result.registrations.length === 0 ? (
            <p role="status">{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {result.registrations.map((row) => (
                <li
                  key={row.gstin}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <section className="min-w-0 space-y-1">
                    <p className="font-mono break-all" dir="ltr">
                      {row.gstin}
                    </p>
                    <p className="text-sm">
                      {row.state} · {row.stateCode} · {row.status}
                    </p>
                  </section>
                  <ActionButton
                    type="button"
                    label={selectionLabel(row)}
                    isDisabled={busy || row.status !== "Active"}
                    onClick={() => {
                      void choose(row.gstin);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <p role="status" aria-live="polite" className="text-sm">
        {failure?.pan === key ? statusCopy(failure.status) : null}
      </p>
    </section>
  );
}
