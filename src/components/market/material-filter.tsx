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
        "h-auto min-h-11 max-w-full gap-2 rounded-full border border-transparent px-4 py-2 text-sm break-words whitespace-normal",
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
 * many lots it has. Wraps into rows on every screen width.
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
      className="flex min-w-0 flex-wrap items-start gap-2"
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
