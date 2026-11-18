"use client";

import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, localeDirection } from "@/i18n/locales";

import {
  getIndiaJurisdiction,
  INDIA_JURISDICTIONS,
} from "../../../convex/data/indiaJurisdictions";

const sourceLinkClassName =
  "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg text-sm underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring";

export function JurisdictionReference() {
  const t = useTranslations("industry");
  const lots = useTranslations("lots");
  const dates = useTranslations("prices.chart");
  const format = useFormatter();
  const locale = useLocale();
  const direction = isLocale(locale) ? localeDirection(locale) : "ltr";
  const id = useId();
  const [jurisdiction, setJurisdiction] = useState("");
  const selected = getIndiaJurisdiction(jurisdiction);

  return (
    <section
      dir={direction}
      aria-labelledby={`${id}-title`}
      className="min-w-0 space-y-5"
    >
      <div className="space-y-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {t("jurisdictionTitle")}
        </h2>
        <p
          id={`${id}-note`}
          className="max-w-3xl text-sm text-muted-foreground"
        >
          {t("jurisdictionNote")}
        </p>
        <p className="text-sm text-muted-foreground">{t("sourceNote")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-jurisdiction`}>{t("chooseJurisdiction")}</Label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
          <Select
            dir={direction}
            value={jurisdiction}
            onValueChange={setJurisdiction}
          >
            <SelectTrigger
              id={`${id}-jurisdiction`}
              dir={direction}
              aria-describedby={`${id}-note`}
              className="min-h-11 w-full min-w-0 whitespace-normal data-[size=default]:h-auto"
            >
              <SelectValue placeholder={t("chooseJurisdiction")}>
                {selected ? (
                  <span lang="en" dir="ltr" className="min-w-0 break-words">
                    {selected.jurisdiction}
                  </span>
                ) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="max-w-[calc(100vw-2rem)]"
            >
              {INDIA_JURISDICTIONS.map((entry) => (
                <SelectItem
                  key={entry.jurisdiction}
                  value={entry.jurisdiction}
                  className="min-h-11 whitespace-normal"
                >
                  <span lang="en" dir="ltr" className="break-words">
                    {entry.jurisdiction}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 self-start"
              onClick={() => {
                setJurisdiction("");
              }}
            >
              {t("clear")}
            </Button>
          ) : null}
        </div>
      </div>
      {selected ? (
        <div className="min-w-0 space-y-4 border-y border-border py-4">
          {selected.authorityUrl ? (
            <a
              href={selected.authorityUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className={sourceLinkClassName}
            >
              <span lang="en" dir="ltr" className="min-w-0 break-words">
                {selected.authorityName ?? selected.jurisdiction}
              </span>
              <ExternalLinkIcon aria-hidden className="size-4 shrink-0" />
            </a>
          ) : null}
          {selected.reviewStatus === "needs_review" ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
              {t("jurisdictionReview")}
            </p>
          ) : null}
          {selected.reviewNote ? (
            <p
              lang="en"
              dir="ltr"
              className="text-sm break-words text-muted-foreground"
            >
              {selected.reviewNote}
            </p>
          ) : null}
          <dl className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">
                {lots("source")}
              </dt>
              <dd className="min-w-0">
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className={sourceLinkClassName}
                >
                  {t("view")}
                  <ExternalLinkIcon aria-hidden className="size-4 shrink-0" />
                </a>
                <p
                  lang="en"
                  dir="ltr"
                  className="text-sm break-words text-muted-foreground"
                >
                  {selected.sourceLocator}
                </p>
                {selected.supportingSources.length > 0 ? (
                  <ul className="min-w-0">
                    {selected.supportingSources.map((source) => (
                      <li key={source.url} className="min-w-0">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className={sourceLinkClassName}
                        >
                          <span
                            lang="en"
                            dir="ltr"
                            className="min-w-0 break-words"
                          >
                            {source.locator}
                          </span>
                          <ExternalLinkIcon
                            aria-hidden
                            className="size-4 shrink-0"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </dd>
            </div>
            {selected.sourceAsOf ? (
              <div>
                <dt className="text-sm text-muted-foreground">
                  {dates("date")}
                </dt>
                <dd className="py-3 text-sm">
                  <time dateTime={selected.sourceAsOf}>
                    {format.dateTime(
                      new Date(`${selected.sourceAsOf}T00:00:00Z`),
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      },
                    )}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
