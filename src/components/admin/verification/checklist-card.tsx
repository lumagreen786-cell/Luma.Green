"use client";

import { ExternalLinkIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

import type { CheckItem } from "./checklist";

/** The role's checks, ticked off as the admin does them. */
export function ChecklistCard({
  items,
  checked,
  onToggle,
}: {
  items: readonly CheckItem[];
  checked: ReadonlySet<string>;
  onToggle: (id: string, isChecked: boolean) => void;
}) {
  const done = items.filter((item) => checked.has(item.id)).length;
  return (
    <section className="flex min-w-0 flex-col gap-4 border-t border-border pt-6">
      <header className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Before you approve
        </h2>
        <p
          className="text-sm leading-relaxed text-muted-foreground"
          aria-live="polite"
        >
          {done} of {items.length} checked
        </p>
      </header>
      <div className="flex flex-col gap-4">
        <Progress
          value={items.length === 0 ? 100 : (done / items.length) * 100}
          aria-label="Checks done"
        />
        <ul className="flex flex-col divide-y">
          {items.map((item) => {
            const id = `check-${item.id}`;
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Checkbox
                  id={id}
                  checked={checked.has(item.id)}
                  onCheckedChange={(value) => {
                    onToggle(item.id, value === true);
                  }}
                  aria-describedby={item.hint ? `${id}-hint` : undefined}
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <Label
                    htmlFor={id}
                    className="min-h-11 leading-relaxed font-normal"
                  >
                    {item.label}
                  </Label>
                  {item.hint ? (
                    <p
                      id={`${id}-hint`}
                      className="text-xs text-muted-foreground"
                    >
                      {item.hint}
                    </p>
                  ) : null}
                  {item.link ? (
                    <a
                      href={item.link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg text-xs font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {item.link.label}
                      <ExternalLinkIcon aria-hidden className="size-3" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
