"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { ListSkeleton } from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api } from "../../../convex/_generated/api";
import type { ReferenceKind } from "../../../convex/lib/industryReference";

type Reference = FunctionReturnType<
  typeof api.industryReference.search
>["items"][number];
const kinds: Record<ReferenceKind, ReferenceKind> = {
  sectors: "sectors",
  industries: "industries",
  lifecycles: "lifecycles",
  byproducts: "byproducts",
};

export function IndustryExplorer({
  onSelect,
}: {
  onSelect?: (item: Reference) => void;
}) {
  const t = useTranslations("industry");
  const common = useTranslations("common");
  const format = useFormatter();
  const id = useId();
  const [kind, setKind] = useState<ReferenceKind>("sectors");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Reference | null>(null);
  const result = useQuery(api.industryReference.search, {
    kind,
    search,
    offset,
  });
  function changeKind(value: string) {
    const next = Object.values(kinds).find((item) => item === value);
    if (!next) {
      return;
    }

    setKind(next);
    setOffset(0);
    setSelected(null);
  }
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/60 bg-card p-5"
    >
      <div className="space-y-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("lead")}</p>
        <p className="text-sm text-muted-foreground">{t("sourceNote")}</p>
      </div>
      {onSelect ? null : (
        <Tabs value={kind} onValueChange={changeKind}>
          <TabsList aria-label={t("title")}>
            {Object.values(kinds).map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(value)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="flex flex-col gap-2">
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
            setSelected(null);
          }}
        />
      </div>
      {result === undefined ? (
        <ListSkeleton />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("matches", { count: format.number(result.total) })}
          </p>
          {result.items.length === 0 ? (
            <p>{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4 sm:px-5">
              {result.items.map((item) => (
                <li key={item.id} className="flex min-w-0 flex-col gap-2 py-4">
                  <h3 className="font-medium break-words" lang="en" dir="ltr">
                    {item.title}
                  </h3>
                  <p
                    className="text-sm text-muted-foreground"
                    lang="en"
                    dir="ltr"
                  >
                    {item.subtitle}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      aria-expanded={selected?.id === item.id}
                      onClick={() => {
                        setSelected(selected?.id === item.id ? null : item);
                      }}
                    >
                      {t("view")}
                    </Button>
                    {onSelect ? (
                      <Button
                        type="button"
                        onClick={() => {
                          onSelect(item);
                        }}
                      >
                        {t("select")}
                      </Button>
                    ) : null}
                  </div>
                  {selected?.id === item.id ? (
                    <section
                      aria-label={t("selected")}
                      className="flex min-w-0 flex-col gap-4 border-s-2 ps-4"
                    >
                      <h3
                        className="font-semibold break-words"
                        lang="en"
                        dir="ltr"
                      >
                        {selected.title}
                      </h3>
                      <p
                        className="text-sm text-muted-foreground"
                        lang="en"
                        dir="ltr"
                      >
                        {selected.sheet} · {format.number(selected.row)}
                      </p>
                      <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                        {selected.details
                          .filter((detail) => detail.value)
                          .map((detail) => (
                            <div key={detail.key} className="min-w-0">
                              <dt className="text-sm text-muted-foreground">
                                {t(`detailLabels.${detail.key}`)}
                              </dt>
                              <dd
                                className="mt-1 break-words"
                                lang="en"
                                dir="ltr"
                              >
                                {detail.value}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </section>
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
                setSelected(null);
              }}
            >
              {t("previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={result.nextOffset === null}
              onClick={() => {
                if (result.nextOffset === null) {
                  return;
                }

                setOffset(result.nextOffset);
                setSelected(null);
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
