"use client";

import { DownloadIcon, RotateCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpdateBridge {
  getState: () => string;
  request: (action: "status" | "check" | "restart") => void;
}

function bridge(): UpdateBridge | null {
  const value: unknown = Reflect.get(window, "lumaAppUpdates");
  return value &&
    typeof value === "object" &&
    "getState" in value &&
    typeof value.getState === "function" &&
    "request" in value &&
    typeof value.request === "function"
    ? (value as UpdateBridge)
    : null;
}

/** Absent in browsers and older shells. Never reloads the hosted page. */
export function NativeUpdateControl({
  compact = false,
}: {
  compact?: boolean;
}) {
  const t = useTranslations("native");
  const common = useTranslations("common");
  const [state, setState] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => {
      setState(bridge()?.getState() ?? null);
    };
    sync();
    document.addEventListener("luma-app-update", sync);
    return () => {
      document.removeEventListener("luma-app-update", sync);
    };
  }, []);
  if (state === null) return null;
  const isReady = state === "ready" || state === "blocked";
  const isBusy = state === "checking";
  const statusKey = {
    blocked: "updateBusy",
    ready: "updateReady",
    failed: "updateFailed",
    unavailable: "updateUnavailable",
    current: "updateCurrent",
  } as const;
  const key = Object.hasOwn(statusKey, state)
    ? statusKey[state as keyof typeof statusKey]
    : "updates";
  const status = isBusy ? common("loading") : t(key);
  return (
    <>
      <ActionButton
        data-app-update-control
        variant="ghost"
        className={
          compact ? "min-h-11 px-3" : "min-h-11 w-full justify-start px-3"
        }
        label={t(isReady ? "updateReady" : "updates")}
        isIconOnly={compact}
        icon={
          <DownloadIcon
            aria-hidden
            className={isReady ? "size-5 text-primary" : "size-5"}
          />
        }
        tooltip={t(isReady ? "updateReady" : "updates")}
        onClick={() => {
          setOpen(true);
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-app-update-dialog closeLabel={common("close")}>
          <DialogHeader>
            <DialogTitle>{t("updates")}</DialogTitle>
            <DialogDescription aria-live="polite">{status}</DialogDescription>
          </DialogHeader>
          <ActionButton
            isDisabled={isBusy || state === "unavailable"}
            label={t(isReady ? "restart" : "updates")}
            icon={
              isReady ? (
                <RotateCwIcon aria-hidden />
              ) : (
                <DownloadIcon aria-hidden />
              )
            }
            onClick={() => bridge()?.request(isReady ? "restart" : "check")}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
