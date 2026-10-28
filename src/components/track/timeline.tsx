"use client";

import { useTranslations } from "next-intl";

import { useFormat } from "@/components/app/format";
import { cn } from "@/lib/utils";

import type { TrackedBooking } from "./types";

/** Every change to the booking, oldest first, with when it happened. */
export function Timeline({
  timeline,
}: {
  timeline: TrackedBooking["timeline"];
}) {
  const t = useTranslations("track.timeline");
  const tReview = useTranslations("track.review");
  const format = useFormat();

  return (
    <section
      aria-labelledby="timeline-title"
      className="flex flex-col gap-3 border-t border-border py-5"
    >
      <h2 id="timeline-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <ol className="flex flex-col">
        {timeline.map((entry, index) => {
          const isLast = index === timeline.length - 1;
          return (
            <li
              key={`${entry.status}-${String(entry.at)}`}
              className="flex gap-3"
            >
              <span aria-hidden className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-1.5 size-2.5 rounded-full",
                    isLast ? "bg-primary" : "bg-border",
                  )}
                />
                {isLast ? null : <span className="w-px flex-1 bg-border" />}
              </span>
              <span className={cn("flex flex-col", isLast ? "" : "pb-4")}>
                <span className={cn(isLast && "font-medium")}>
                  {entry.status === "completed"
                    ? tReview("title")
                    : t(entry.status)}
                </span>
                <time
                  dateTime={new Date(entry.at).toISOString()}
                  className="text-sm text-muted-foreground"
                >
                  {format.dateTime(entry.at)}
                </time>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
