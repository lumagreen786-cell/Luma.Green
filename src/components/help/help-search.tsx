"use client";

import { MessageCircleQuestionIcon, SearchIcon, XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

import { HELP_TOPICS, type HelpTopic, TOPIC_ICONS } from "./content";
import { IconTile } from "./help-art";
import { buildHelpIndex, type HelpEntry, searchHelp } from "./search";

/** Results shown before "Show all". */
const FIRST_RESULTS = 8;

/**
 * Search every guide and question, in the reader's language, entirely in the
 * browser — plus one-tap topics for people who'd rather not type.
 */
export function HelpSearch() {
  const t = useTranslations("help");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [showAll, setShowAll] = useState(false);

  const entries = useMemo(
    () =>
      buildHelpIndex((key) => {
        return t(key);
      }),
    [t],
  );
  const results = useMemo(
    () => searchHelp(entries, { query, topic }),
    [entries, query, topic],
  );
  const trimmed = query.trim();
  const isActive = trimmed !== "" || topic !== null;

  let summary = "";
  if (trimmed) {
    summary = t("search.summary", { count: results.length, query: trimmed });
  } else if (topic) {
    summary = t("search.topicSummary", {
      count: results.length,
      topic: t(`topics.${topic}`),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        className="relative max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {t("search.label")}
        </label>
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={t("search.label")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowAll(false);
          }}
          className="h-12 rounded-lg bg-background ps-12 pe-12 text-base shadow-none md:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={t("search.clear")}
            className="absolute end-2 top-1/2 -translate-y-1/2"
            onClick={() => {
              setQuery("");
              setShowAll(false);
            }}
          >
            <XIcon aria-hidden />
          </Button>
        ) : null}
      </form>

      <div className="flex flex-col gap-3">
        <h2 id="help-topics" className="text-sm font-medium">
          {t("topicsHeading")}
        </h2>
        <ul aria-labelledby="help-topics" className="flex flex-wrap gap-2">
          {HELP_TOPICS.map((key) => {
            const Icon = TOPIC_ICONS[key];
            const isPressed = topic === key;
            return (
              <li key={key} className="max-w-full min-w-0">
                <Button
                  type="button"
                  data-help-topic
                  className="h-auto min-h-11 max-w-full justify-start py-2 text-start whitespace-normal"
                  variant={isPressed ? "default" : "outline"}
                  aria-pressed={isPressed}
                  onClick={() => {
                    setTopic(isPressed ? null : key);
                    setShowAll(false);
                  }}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 wrap-anywhere">
                    {t(`topics.${key}`)}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {summary}
      </p>

      {isActive ? (
        <section
          aria-label={summary}
          className="flex flex-col gap-2 border-y py-4"
        >
          <p aria-hidden className="px-2 text-sm font-medium">
            {summary}
          </p>
          {results.length === 0 ? (
            <NoResults />
          ) : (
            <ul className="flex flex-col">
              {(showAll ? results : results.slice(0, FIRST_RESULTS)).map(
                (entry) => (
                  <ResultItem key={entry.id} entry={entry} />
                ),
              )}
            </ul>
          )}
          {!showAll && results.length > FIRST_RESULTS ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 self-start"
              onClick={() => {
                setShowAll(true);
              }}
            >
              {t("search.showMore", { count: results.length })}
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ResultItem({ entry }: { entry: HelpEntry }) {
  const t = useTranslations("help");
  const format = useFormatter();
  const roles = format.list(
    entry.roles.map((role) => t(`roles.${role}.name`)),
    { type: "conjunction" },
  );
  return (
    <li className="relative flex gap-3 border-b px-2 py-4 last:border-b-0 hover:bg-muted/60 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <IconTile icon={TOPIC_ICONS[entry.topic]} size="sm" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="font-semibold text-foreground">
            {t(entry.kind === "guide" ? "search.guide" : "search.question")}
          </span>
          {t(`topics.${entry.topic}`)}
        </p>
        <h3 className="font-medium">
          <Link
            href={entry.href}
            className="outline-none after:absolute after:inset-0"
          >
            {entry.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {entry.snippet}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("search.forRoles", { roles })}
        </p>
      </div>
    </li>
  );
}

function NoResults() {
  const t = useTranslations("help");
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        <MessageCircleQuestionIcon aria-hidden className="size-6" />
      </span>
      <p className="font-medium">{t("search.emptyTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("search.emptyBody")}
      </p>
      <Button asChild variant="outline" className="mt-2 h-11 px-4">
        <Link href="/help/contact">{t("search.ask")}</Link>
      </Button>
    </div>
  );
}
