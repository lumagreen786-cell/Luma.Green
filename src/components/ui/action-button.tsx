"use client";

import { Button, type ButtonProps } from "@astryxdesign/core/Button";

import { cn } from "@/lib/utils";

/** Explicit labels keep Astryx actions accessible across all translated flows. */
export function ActionButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="primary"
      size="lg"
      data-slot="button"
      className={cn("min-h-12 min-w-11 px-6 text-sm font-medium", className)}
      {...props}
    />
  );
}
