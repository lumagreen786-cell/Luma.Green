"use client";

import { useId, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INDIA_REGULATORY_REFERENCES,
  isOfficialReferenceUrl,
} from "@/lib/india-regulatory-references";

const STATUS_LABELS = {
  notified: "Notified rule",
  guidance: "Published guidance",
  draft: "Draft · not in force",
  portal: "Official portal / notice",
} as const;

export function IndiaRegulatoryReferences() {
  const id = useId();
  const [stream, setStream] = useState("all");
  const streams = [
    ...new Set(INDIA_REGULATORY_REFERENCES.map((r) => r.stream)),
  ];
  const references = INDIA_REGULATORY_REFERENCES.filter(
    (r) => stream === "all" || r.stream === stream,
  );

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="space-y-4 border-y py-6"
    >
      <div className="space-y-2">
        <h2 id={`${id}-heading`} className="text-xl font-semibold">
          India regulatory references
        </h2>
        <p className="text-sm text-muted-foreground">Reviewed 2026-10-28</p>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This reference list does not approve a facility, authorize a movement
          or issue a certificate. Check current orders and real site evidence.
          It is not a complete all-state legal engine.
        </p>
      </div>
      <div className="max-w-sm space-y-2">
        <Label htmlFor={`${id}-stream`}>Reference stream</Label>
        <Select value={stream} onValueChange={setStream}>
          <SelectTrigger id={`${id}-stream`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All streams</SelectItem>
            {streams.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ul className="divide-y">
        {references.map((r) => (
          <li key={r.id} className="min-w-0 space-y-2 py-4">
            <p className="text-sm font-medium">
              {r.stream} · {STATUS_LABELS[r.status]}
            </p>
            <h3 className="font-semibold">{r.title}</h3>
            <p className="text-sm text-muted-foreground">
              {r.publisher} · Document: {r.documentDate}
            </p>
            <p className="text-sm">
              {r.effectiveDate
                ? `Effective: ${r.effectiveDate}`
                : "Effective date: not established / not applicable"}
            </p>
            {isOfficialReferenceUrl(r.url) ? (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Open official source<span className="sr-only">: {r.title}</span>
              </a>
            ) : null}
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Applicability and evidence
              </summary>
              <div className="max-w-3xl space-y-3 pb-2">
                <p>{r.applicability}</p>
                <ul
                  aria-label={`Evidence for ${r.title}`}
                  className="list-disc space-y-1 ps-5"
                >
                  {r.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground">Limits: {r.limits}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
