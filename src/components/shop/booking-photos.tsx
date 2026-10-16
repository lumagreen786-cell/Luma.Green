"use client";

import { useAction, useQuery } from "convex/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/sell/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MAX_HOUSEHOLD_PHOTOS } from "../../../convex/lib/householdPhotos";

/** Only render inside the authenticated booking view. Each read checks access
 * again on the server; private bytes stay in revocable, local object URLs. */
export function BookingPhotos({ bookingId }: { bookingId: Id<"bookings"> }) {
  const common = useTranslations("common");
  return (
    <ErrorBoundary
      key={bookingId}
      fallback={(reset) => (
        <div className="space-y-3">
          <p role="alert">{common("error")}</p>
          <Button variant="outline" onClick={reset}>
            {common("retry")}
          </Button>
        </div>
      )}
    >
      <PhotoList bookingId={bookingId} />
    </ErrorBoundary>
  );
}

function PhotoList({ bookingId }: { bookingId: Id<"bookings"> }) {
  const photos = useQuery(api.householdPhotos.list, { bookingId });
  const t = useTranslations("sell.simple");
  const common = useTranslations("common");
  if (photos === undefined)
    return <Skeleton className="h-40 w-full" aria-label={common("loading")} />;
  if (photos.length === 0) return null;
  return (
    <section
      aria-label={t("attachedPhotos")}
      className="space-y-4 border-t pt-6"
    >
      <h2 className="text-lg font-semibold">{t("attachedPhotos")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.slice(0, MAX_HOUSEHOLD_PHOTOS).map((photo) => (
          <PrivatePhoto key={photo.id} photoId={photo.id} name={photo.name} />
        ))}
      </div>
    </section>
  );
}

function PrivatePhoto({
  photoId,
  name,
}: {
  photoId: Id<"householdPhotos">;
  name: string;
}) {
  const [attempt, setAttempt] = useState(0);
  return (
    <PhotoBytes
      key={attempt}
      photoId={photoId}
      name={name}
      onRetry={() => {
        setAttempt((value) => value + 1);
      }}
    />
  );
}

function PhotoBytes({
  photoId,
  name,
  onRetry,
}: {
  photoId: Id<"householdPhotos">;
  name: string;
  onRetry: () => void;
}) {
  const read = useAction(api.householdPhotos.read);
  const common = useTranslations("common");
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let isObsolete = false;
    let objectUrl: string | undefined;
    void read({ photoId })
      .then((photo) => {
        if (isObsolete) return;
        objectUrl = URL.createObjectURL(
          new Blob([photo.bytes], { type: photo.contentType }),
        );
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!isObsolete) setFailed(true);
      });
    return () => {
      isObsolete = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId, read]);
  if (failed)
    return (
      <div className="space-y-3">
        <p role="alert">{common("error")}</p>
        <Button variant="outline" onClick={onRetry}>
          {common("retry")}
        </Button>
      </div>
    );
  if (!url)
    return (
      <Skeleton
        className="aspect-[4/3] w-full"
        aria-label={common("loading")}
      />
    );
  return (
    <Image
      src={url}
      alt={name}
      width={480}
      height={360}
      unoptimized
      className="aspect-[4/3] w-full rounded-lg bg-muted object-contain"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
