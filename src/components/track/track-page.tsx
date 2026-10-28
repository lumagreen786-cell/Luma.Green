"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { SearchXIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/app/page-parts";
import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { ErrorBoundary, LoadError, SellUnavailable } from "../sell/states";
import { CollectionSharing } from "./receipt-sharing";
import { TrackView } from "./track-view";

/** Collection access requires a current session and record permission. */
export function TrackPage({ token }: { token: string }) {
  if (!isConvexConfigured) return <SellUnavailable />;
  return (
    <ErrorBoundary fallback={(reset) => <LoadError onRetry={reset} />}>
      <LiveTrack token={token} />
    </ErrorBoundary>
  );
}

function LiveTrack({ token }: { token: string }) {
  const t = useTranslations("track.review");
  const auth = useConvexAuth();
  const returnPath = `/t/${token}`;
  const booking = useQuery(
    api.households.track,
    auth.isAuthenticated ? { token } : "skip",
  );
  if (!auth.isLoading && !auth.isAuthenticated)
    return (
      <Button asChild>
        <Link href={`/login?next=${encodeURIComponent(returnPath)}`}>
          {t("signIn")}
        </Link>
      </Button>
    );
  if (booking === undefined) return <TrackSkeleton />;
  return booking === null ? (
    <>
      <TrackNotFound />
      <CollectionSharing token={token} owner={false} open />
    </>
  ) : (
    <TrackView booking={booking} />
  );
}

export function TrackSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}

export function TrackNotFound() {
  const t = useTranslations("track.notFound");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">{t("title")}</h1>
      <EmptyState
        icon={SearchXIcon}
        title={t("title")}
        body={t("body")}
        action={
          <Button asChild size="lg" className="mt-2 h-12 text-base">
            <Link href="/sell">{t("sell")}</Link>
          </Button>
        }
      />
    </div>
  );
}
