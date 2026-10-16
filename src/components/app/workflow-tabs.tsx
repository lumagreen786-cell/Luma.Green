"use client";

import { useLocale } from "next-intl";
import { type ReactNode, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isLocale, localeDirection } from "@/i18n/locales";

/** Distinct tasks get distinct views; keep mounted forms so switching views
 * never discards an unfinished draft or uploads a file implicitly. */
export function WorkflowTabs({
  items,
  defaultValue,
}: {
  items: { value: string; label: string; content: ReactNode }[];
  defaultValue?: string;
}) {
  const locale = useLocale();
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
    >
      <TabsList className="h-auto w-full flex-wrap justify-start gap-x-5 gap-y-1 rounded-none border-b bg-transparent p-0 pb-2">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="min-h-11 flex-none rounded-none px-0 shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items
        .filter((item) => visited.has(item.value) || item.value === selected)
        .map((item) => (
          <TabsContent
            key={item.value}
            value={item.value}
            forceMount
            hidden={selected !== item.value}
            className="pt-5 data-[state=inactive]:hidden"
          >
            {item.content}
          </TabsContent>
        ))}
    </Tabs>
  );
}
