import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { BoardColumns } from "./price-row";

/** Keep the price layout visible without presenting sample rates as live data. */
export function PricePlaceholder({
  state,
  compact = false,
}: {
  state: "loading" | "unavailable" | "empty";
  compact?: boolean;
}) {
  const common = useTranslations("common");
  const prices = useTranslations("prices");
  const teaser = useTranslations("home.teaser");
  const isLoading = state === "loading";
  const loadingRows = compact ? 4 : 6;
  const rowCount = isLoading ? loadingRows : 1;
  let title = common("loading");
  if (!isLoading) {
    title = compact ? teaser("unavailable") : prices(`${state}.title`);
  }
  const skeletonClass = isLoading
    ? "motion-reduce:animate-none"
    : "animate-none";

  return (
    <div
      role="status"
      aria-label={title}
      aria-busy={isLoading}
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="space-y-1">
        <p
          className={compact ? "text-sm text-muted-foreground" : "font-medium"}
        >
          {title}
        </p>
        {!isLoading && !compact ? (
          <p className="text-sm text-muted-foreground">
            {prices(`${state}.body`)}
          </p>
        ) : null}
      </div>
      <div aria-hidden className="divide-y border-y border-border">
        {compact ? null : <BoardColumns />}
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={index}
            className="flex min-h-16 items-center gap-4 py-4 sm:gap-6"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={cn("h-4 w-32 max-w-full", skeletonClass)} />
              <Skeleton className={cn("h-2 w-20 max-w-full", skeletonClass)} />
            </div>
            <Skeleton className={cn("h-3 w-16 shrink-0", skeletonClass)} />
            {compact ? null : (
              <Skeleton
                className={cn(
                  "hidden h-3 w-16 shrink-0 sm:block",
                  skeletonClass,
                )}
              />
            )}
            <Skeleton className={cn("h-5 w-14 shrink-0", skeletonClass)} />
          </div>
        ))}
      </div>
    </div>
  );
}
