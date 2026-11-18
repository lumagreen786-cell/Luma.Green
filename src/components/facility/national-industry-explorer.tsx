"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { ListSkeleton } from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { api } from "../../../convex/_generated/api";

type Activity = FunctionReturnType<
  typeof api.industryReference.nationalSearch
>["items"][number];

export function NationalIndustryExplorer({
  onSelect,
}: {
  onSelect?: (activity: Activity) => void;
}) {
  const t = useTranslations("industry");
  const common = useTranslations("common");
  const format = useFormatter();
  const id = useId();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const result = useQuery(api.industryReference.nationalSearch, {
    search,
    offset,
  });

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 space-y-5">
      <div className="space-y-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {t("nationalTitle")}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("nationalNote")}
        </p>
        <p className="text-sm text-muted-foreground">{t("sourceNote")}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor={`${id}-search`} className="text-sm font-medium">
          {common("search")}
        </label>
        <Input
          id={`${id}-search`}
          type="search"
          maxLength={200}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
        />
      </div>
      {result === undefined ? (
        <ListSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p role="status">
              {t("matches", { count: format.number(result.total) })}
            </p>
            <a
              href={result.sourcePublicationUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              lang="en"
              dir="ltr"
            >
              MoSPI · {result.sourceVersion}
            </a>
          </div>
          {result.items.length === 0 ? (
            <p>{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {result.items.map((activity) => (
                <li
                  key={activity.code}
                  className="flex min-w-0 flex-col items-start gap-3 py-4 sm:flex-row sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-sm" dir="ltr" lang="en">
                      {activity.code}
                    </p>
                    <h3 className="break-words" dir="ltr" lang="en">
                      {activity.title}
                    </h3>
                  </div>
                  {onSelect ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      aria-label={`${t("select")}: ${activity.code}`}
                      onClick={() => {
                        onSelect(activity);
                      }}
                    >
                      {t("select")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={offset === 0}
              onClick={() => {
                setOffset(Math.max(0, offset - 25));
              }}
            >
              {t("previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={result.nextOffset === null}
              onClick={() => {
                if (result.nextOffset !== null) setOffset(result.nextOffset);
              }}
            >
              {t("next")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
