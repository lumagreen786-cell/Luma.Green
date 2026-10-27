"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { api } from "../../../../convex/_generated/api";
import { ApplicationReview } from "./application-review";
import { VerificationQueue } from "./queue";

/** Keep the review queue mounted so a decision does not lose its place. */
export function VerificationWorkspace() {
  const queue = useQuery(api.review.queue);
  const [selected, setSelected] = useState<string>();
  const [decided, setDecided] = useState(false);
  const detail = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const returnScroll = useRef(0);
  const next = queue?.find(
    (row) => row.status === "submitted" && row.id !== selected,
  );
  function select(id: string) {
    if (
      document.activeElement instanceof HTMLElement &&
      list.current?.contains(document.activeElement)
    ) {
      opener.current = document.activeElement;
      returnScroll.current = window.scrollY;
    }
    setSelected(id);
    setDecided(false);
  }
  useEffect(() => {
    if (selected) detail.current?.focus();
    else if (opener.current) {
      if (opener.current.isConnected)
        opener.current.focus({ preventScroll: true });
      else list.current?.focus({ preventScroll: true });
      window.scrollTo({ top: returnScroll.current });
    }
  }, [selected]);
  return (
    <div
      className={
        selected
          ? "grid min-w-0 gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]"
          : "min-w-0"
      }
    >
      <div
        ref={list}
        tabIndex={-1}
        role="region"
        aria-label="Verification queue"
        className={selected ? "hidden min-w-0 xl:block" : "min-w-0"}
      >
        <VerificationQueue onSelect={select} compact={Boolean(selected)} />
      </div>
      {selected ? (
        <section
          ref={detail}
          tabIndex={-1}
          aria-label="Application review"
          className="min-w-0 space-y-4 outline-none xl:border-s xl:ps-6"
        >
          {decided ? (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 border-b pb-4"
            >
              <p>Decision saved.</p>
              {next ? (
                <Button
                  onClick={() => {
                    select(next.id);
                  }}
                >
                  Review next
                </Button>
              ) : (
                <p>No more applications waiting.</p>
              )}
            </div>
          ) : null}
          <ApplicationReview
            key={selected}
            applicationId={selected}
            onBack={() => {
              setSelected(undefined);
            }}
            onDecided={() => {
              setDecided(true);
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
