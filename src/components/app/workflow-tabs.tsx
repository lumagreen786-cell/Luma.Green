"use client";

import { useFormatter, useLocale } from "next-intl";
import { type ReactNode, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isLocale, localeDirection } from "@/i18n/locales";

/** Distinct tasks get distinct views; keep mounted forms so switching views
 * never discards an unfinished draft or uploads a file implicitly. */
export function WorkflowTabs({
  items,
  defaultValue,
}: {
  items: { value: string; label: string; content: ReactNode; count?: number }[];
  defaultValue?: string;
}) {
  const locale = useLocale();
  const format = useFormatter();
  const initial = defaultValue ?? items[0]?.value;
  const [active, setActive] = useState(initial);
  const [visited, setVisited] = useState(new Set([initial]));
  const selected = items.some((item) => item.value === active)
    ? active
    : items[0]?.value;
  return (
    <Tabs
      value={selected}
      onValueChange={(value) => {
        setActive(value);
        setVisited((previous) => new Set([...previous, value]));
      }}
      dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
      className="min-w-0 gap-6"
    >
      <div className="flex min-w-0 border-b border-border/60 pb-4">
        <TabsList className="h-auto w-fit max-w-full flex-wrap justify-start gap-2 rounded-2xl bg-muted/40 p-1.5">
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              count={
                item.count === undefined ? undefined : format.number(item.count)
              }
              className="min-h-11 flex-none gap-2 rounded-2xl bg-card px-4 shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {items
        .filter((item) => visited.has(item.value) || item.value === selected)
        .map((item) => (
          <TabsContent
            key={item.value}
            value={item.value}
            forceMount
            hidden={selected !== item.value}
            className="min-w-0 data-[state=inactive]:hidden"
          >
            {item.content}
          </TabsContent>
        ))}
    </Tabs>
  );
}
