"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { BellIcon, CheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { useVerifiedSession } from "@/components/providers/use-signed-in-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { reloadCurrentPage } from "@/lib/reload-current-page";

import { api } from "../../../convex/_generated/api";
import { useNotificationDevice } from "./device-provider";
import { NotificationErrorBoundary } from "./notification-error-boundary";

export function NotificationsPage() {
  const t = useTranslations("notifications");
  const common = useTranslations("common");
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0">
      <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
        {t("title")}
      </h1>
      <DeviceSettings />
      {isConvexConfigured ? (
        <NotificationErrorBoundary
          fallback={
            <div className="space-y-4 py-6">
              <p role="alert" className="text-muted-foreground">
                {t("unavailable")}
              </p>
              <Button onClick={reloadCurrentPage}>{common("retry")}</Button>
            </div>
          }
        >
          <Inbox />
        </NotificationErrorBoundary>
      ) : (
        <p className="py-6 text-muted-foreground">{t("unavailable")}</p>
      )}
    </div>
  );
}

function DeviceSettings() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const device = useNotificationDevice();
  const [failed, setFailed] = useState(false);
  const isEnabled = device?.status === "granted";
  async function toggle() {
    if (!device || device.signingOut) return;
    setFailed(false);
    try {
      await (isEnabled ? device.disable() : device.enable());
    } catch {
      setFailed(true);
    }
  }
  let status = t("disabled");
  if (!device || device.status === "unavailable") status = t("unavailable");
  else if (isEnabled) status = t("enabled");
  else if (device.status === "denied") status = t("denied");
  else if (failed || device.status === "error") status = t("error");
  const actionLabel = t(isEnabled ? "disable" : "enable");
  const buttonLabel =
    device?.status === "busy" || device?.signingOut
      ? tc("loading")
      : actionLabel;
  return (
    <section
      aria-labelledby="notification-device"
      className="mt-6 flex flex-col gap-3 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="min-w-0">
        <h2 id="notification-device" className="font-semibold">
          {t("deviceTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("permissionBody")}
        </p>
        <p
          role={failed || device?.status === "error" ? "alert" : "status"}
          className="mt-2 text-sm text-muted-foreground"
        >
          {status}
        </p>
      </div>
      <Button
        variant={isEnabled ? "outline" : "default"}
        className="shrink-0 self-start"
        disabled={
          !device ||
          device.signingOut ||
          device.status === "busy" ||
          device.status === "unavailable"
        }
        onClick={() => {
          void toggle();
        }}
      >
        {buttonLabel}
      </Button>
    </section>
  );
}

/** Mount private subscriptions only after Convex confirms the client identity. */
function Inbox() {
  const { isReady, isPending, userId } = useVerifiedSession();
  const t = useTranslations("notifications");
  const common = useTranslations("common");
  if (isPending)
    return (
      <div
        aria-busy="true"
        aria-label={common("loading")}
        className="space-y-4 py-6"
      >
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  if (!isReady)
    return (
      <p role="status" className="py-6 text-muted-foreground">
        {t("unavailable")}
      </p>
    );
  return <AuthenticatedInbox key={userId} />;
}

function AuthenticatedInbox() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const format = useFormatter();
  const { results, status, loadMore } = usePaginatedQuery(
    api.inbox.list,
    {},
    { initialNumItems: 20 },
  );
  const count = useQuery(api.inbox.unreadCount, {});
  const markRead = useMutation(api.inbox.markRead);
  const markAllRead = useMutation(api.inbox.markAllRead);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function change(action: () => Promise<unknown>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="notification-inbox" className="pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="notification-inbox" className="text-lg font-semibold">
          {t("inboxTitle")}
        </h2>
        {count ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              void change(() => markAllRead({}));
            }}
          >
            {t("markAllRead")}
          </Button>
        ) : null}
      </div>
      {failed ? (
        <p role="alert" className="py-2 text-sm text-destructive">
          {tc("error")}
        </p>
      ) : null}
      {status === "LoadingFirstPage" ? (
        <div aria-label={tc("loading")} className="space-y-4 py-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}
      {status !== "LoadingFirstPage" && results.length === 0 ? (
        <div className="flex gap-3 py-6">
          <BellIcon
            aria-hidden
            className="mt-1 size-5 shrink-0 text-muted-foreground"
          />
          <div>
            <h3 className="font-medium">{t("emptyTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("emptyBody")}
            </p>
          </div>
        </div>
      ) : null}
      <ul className="mt-2 divide-y divide-border">
        {results.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 py-4 sm:flex-nowrap"
          >
            <div className="min-w-0 flex-1 basis-48">
              <p
                className={item.read ? "text-muted-foreground" : "font-medium"}
              >
                {t(`events.${item.event}`)}
              </p>
              <time
                dateTime={new Date(item.createdAt).toISOString()}
                className="mt-1 block text-sm text-muted-foreground"
              >
                {format.dateTime(item.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            {item.read ? null : (
              <Button
                variant="ghost"
                className="shrink-0"
                disabled={busy}
                onClick={() => {
                  void change(() => markRead({ id: item.id }));
                }}
              >
                <CheckIcon aria-hidden className="size-4" />
                {t("markRead")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          className="mt-4"
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => {
            loadMore(20);
          }}
        >
          {status === "LoadingMore" ? tc("loading") : t("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
