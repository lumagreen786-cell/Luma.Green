"use client";

import { SearchIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  defaultLocale,
  isLocale,
  type Locale,
  localeMeta,
  locales,
} from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { markLanguageChosen } from "./storage";

/** Kannada, Hindi and English lead for the Bengaluru pilot; then the rest. */
const PILOT_ORDER: ReadonlySet<Locale> = new Set(["kn", "hi", "en"]);
const ordered: readonly Locale[] = [
  ...PILOT_ORDER,
  ...locales.filter((code) => !PILOT_ORDER.has(code)),
];

/**
 * Search in either script, select a language, then continue in that language.
 * Keep selection separate from navigation so keyboard users can browse safely.
 */
export function LanguageChoice({ onDone }: { onDone: () => void }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const help = useTranslations("help.search");
  const locale = useLocale();
  const current = isLocale(locale) ? locale : defaultLocale;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Locale>(current);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matches = ordered.filter((code) =>
    `${localeMeta[code].label} ${localeMeta[code].english}`
      .toLowerCase()
      .includes(query),
  );

  function choose(code: Locale) {
    markLanguageChosen();
    if (code === current) {
      onDone();
      return;
    }
    const query = Object.fromEntries(searchParams.entries());
    startTransition(() => {
      router.replace({ pathname, query }, { locale: code });
    });
  }

  return (
    <form
      aria-labelledby="choose-language"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        choose(selected);
      }}
    >
      <div className="flex flex-col gap-1">
        <h1
          id="choose-language"
          className="font-display text-2xl leading-[1.25] font-semibold tracking-tight"
        >
          {t("chooseLanguage")}
        </h1>
        <p className="text-muted-foreground">{t("chooseLanguageHint")}</p>
      </div>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={common("search")}
          placeholder={common("search")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          disabled={isPending}
          className="ps-10"
        />
      </div>
      <RadioGroup
        value={selected}
        onValueChange={(value) => {
          if (isLocale(value)) setSelected(value);
        }}
        aria-label={common("language")}
        dir={localeMeta[current].dir}
        disabled={isPending}
        className="max-h-56 gap-0 overflow-y-auto overscroll-contain border-y border-border"
      >
        {matches.map((code) => {
          const isSelected = code === selected;
          return (
            <Label
              key={code}
              htmlFor={`language-${code}`}
              className={cn(
                "relative min-h-12 cursor-pointer gap-3 border-b border-border px-2 py-2 last:border-b-0 focus-within:bg-accent hover:bg-accent",
                isSelected && "bg-accent text-primary",
              )}
            >
              <RadioGroupItem
                id={`language-${code}`}
                value={code}
                aria-labelledby={
                  localeMeta[code].english === localeMeta[code].label
                    ? `language-${code}-native`
                    : `language-${code}-native language-${code}-english`
                }
              />
              <span
                id={`language-${code}-native`}
                lang={localeMeta[code].hreflang}
                dir={localeMeta[code].dir}
                className="text-base font-medium"
              >
                {localeMeta[code].label}
              </span>
              {localeMeta[code].english === localeMeta[code].label ? null : (
                <span
                  id={`language-${code}-english`}
                  className="ms-auto text-xs text-muted-foreground"
                  lang="en"
                  dir="ltr"
                >
                  {localeMeta[code].english}
                </span>
              )}
            </Label>
          );
        })}
        {matches.length === 0 ? (
          <p role="status" className="px-2 py-4 text-sm text-muted-foreground">
            {help("emptyTitle")}
          </p>
        ) : null}
      </RadioGroup>
      <div className="flex flex-col gap-3">
        <p
          role="status"
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"
        >
          <span className="text-muted-foreground">{common("language")}</span>{" "}
          <bdi lang={localeMeta[selected].hreflang} className="font-medium">
            {localeMeta[selected].label}
          </bdi>
        </p>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base"
          disabled={isPending}
        >
          {t("continue")}
        </Button>
      </div>
    </form>
  );
}
