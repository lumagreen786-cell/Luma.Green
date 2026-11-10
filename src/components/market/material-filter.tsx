"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { MaterialOption } from "./logic";

function Chip({
  isPressed,
  onPress,
  children,
}: {
  isPressed: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isPressed}
      onClick={onPress}
      className={cn(
        "min-h-11 shrink-0 gap-2 rounded-full border border-transparent px-4 text-sm whitespace-nowrap",
        isPressed
          ? "border-primary/20 bg-accent text-accent-foreground"
          : "border-transparent bg-card text-muted-foreground",
      )}
    >
      {children}
    </Button>
  );
}

/**
 * Material filters above the lots: "All", then each material on sale with how
 * many lots it has. Scrolls sideways on a phone; wraps on wider screens.
 */
export function MaterialFilter({
  options,
  value,
  onChange,
}: {
  options: readonly MaterialOption[];
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const t = useTranslations("market.browse");
  return (
    <div
      role="group"
      aria-label={t("filterLabel")}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      <Chip
        isPressed={value === null}
        onPress={() => {
          onChange(null);
        }}
      >
        {t("all")}
      </Chip>
      {options.map((option) => (
        <Chip
          key={option.code}
          isPressed={value === option.code}
          onPress={() => {
            onChange(option.code);
          }}
        >
          {option.label}
          <span className="text-muted-foreground tabular-nums">
            {option.count}
          </span>
        </Chip>
      ))}
    </div>
  );
}
