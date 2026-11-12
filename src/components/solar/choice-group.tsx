"use client";

import type { LucideIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isLocale, localeMeta } from "@/i18n/locales";
import { cn } from "@/lib/utils";

/**
 * One of two choices: labelled radio rows, or — `compact` — an underline
 * selector whose options are the radios themselves. Both are a
 * real radio group, named by the element whose id is `labelledBy`.
 */
export function ChoiceGroup<T extends string>({
  name,
  labelledBy,
  options,
  value,
  onChange,
  compact = false,
}: {
  name: string;
  labelledBy: string;
  options: readonly { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  const locale = useLocale();
  return (
    <RadioGroup
      dir={localeMeta[isLocale(locale) ? locale : "en"].dir}
      name={name}
      aria-labelledby={labelledBy}
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next);
        if (option) onChange(option.value);
      }}
      className={cn(
        compact
          ? "flex flex-wrap gap-x-4 gap-y-1"
          : "grid-cols-1 gap-x-5 gap-y-0 min-[400px]:grid-cols-2",
      )}
    >
      {options.map((option) =>
        compact ? (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            className="flex min-h-11 items-center justify-center border-b-2 border-transparent px-2 text-center text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:bg-muted/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:text-foreground"
          >
            {option.label}
          </RadioGroupPrimitive.Item>
        ) : (
          <ChoiceRow
            key={option.value}
            id={`${name}-${option.value}`}
            option={option}
            isSelected={option.value === value}
          />
        ),
      )}
    </RadioGroup>
  );
}

function ChoiceRow({
  id,
  option,
  isSelected,
}: {
  id: string;
  option: { value: string; label: string; icon?: LucideIcon };
  isSelected: boolean;
}) {
  const Icon = option.icon;
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 border-b py-2 text-base leading-normal font-normal hover:bg-muted/40",
        isSelected ? "border-primary" : "border-border",
      )}
    >
      <RadioGroupItem id={id} value={option.value} />
      {Icon ? (
        <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      ) : null}
      {option.label}
    </Label>
  );
}
