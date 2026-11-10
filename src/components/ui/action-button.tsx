"use client";

import { LoaderCircleIcon } from "lucide-react";
import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  useRef,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ActionButtonProps extends ComponentProps<"button"> {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isDisabled?: boolean;
  isLoading?: boolean;
  isInterruptible?: boolean;
  clickAction?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  icon?: ReactNode;
  isIconOnly?: boolean;
  endContent?: ReactNode;
  tooltip?: string;
  width?: string | number;
}

/** Preserve the labelled action API while sharing the Luma button primitive. */
export function ActionButton({
  label,
  variant = "primary",
  size = "lg",
  isDisabled = false,
  isLoading = false,
  isInterruptible = false,
  clickAction,
  onClick,
  icon,
  isIconOnly = false,
  endContent,
  tooltip,
  width,
  children,
  className,
  style,
  type = "button",
  disabled = false,
  onKeyDown,
  ...props
}: ActionButtonProps) {
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const isBusy = isLoading || pending;
  const isBlocked = disabled || isDisabled || (isBusy && !isInterruptible);
  const isAriaDisabled = tooltip !== undefined && isBlocked;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isBlocked || (!isInterruptible && inFlight.current)) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (!clickAction || event.defaultPrevented) return;
    // State updates alone cannot stop two clicks in the same event turn.
    inFlight.current = true;
    startTransition(async () => {
      try {
        await clickAction(event);
      } finally {
        inFlight.current = false;
      }
    });
  };
  const standardSize = size === "md" ? "default" : size;
  const button = (
    <Button
      {...props}
      type={type}
      variant={variant === "primary" ? "default" : variant}
      size={isIconOnly ? "icon" : standardSize}
      aria-label={props["aria-label"] ?? label}
      aria-busy={isBusy || undefined}
      aria-disabled={isBlocked || undefined}
      disabled={isBlocked && !isAriaDisabled}
      style={{ ...style, ...(width !== undefined && { width }) }}
      className={cn(
        "relative h-auto min-h-12 max-w-full min-w-11 px-6 py-3 text-sm font-medium",
        isIconOnly && "px-0",
        isBusy && !isDisabled && !disabled && "disabled:opacity-100",
        className,
      )}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (isAriaDisabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          return;
        }
        onKeyDown?.(event);
      }}
    >
      {isBusy ? (
        <LoaderCircleIcon
          aria-hidden
          className="size-4 shrink-0 motion-safe:animate-spin"
        />
      ) : (
        icon
      )}
      {isIconOnly ? null : (
        <span className="min-w-0 text-center whitespace-normal">
          {children ?? label}
        </span>
      )}
      {isIconOnly ? null : endContent}
    </Button>
  );
  if (tooltip === undefined) return button;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
