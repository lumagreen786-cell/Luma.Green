"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { usePathname } from "@/i18n/navigation";
import {
  type AnalyticsChoice,
  analyticsPage,
  readAnalyticsChoice,
  saveAnalyticsChoice,
} from "@/lib/analytics";
import { stopAnalytics } from "@/lib/analytics-runtime";

const AnalyticsEnabled = dynamic(
  async () => {
    const module_ = await import("./analytics-enabled");
    return module_.AnalyticsEnabled;
  },
  { ssr: false },
);

function subscribe(onChange: () => void) {
  function changed() {
    if (readAnalyticsChoice() === "denied") stopAnalytics();
    onChange();
  }
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener("storage", changed);
  };
}
const serverChoice = () => "denied" as const;

export function AnalyticsControls() {
  const t = useTranslations("analytics");
  const pathname = usePathname();
  const stored = useSyncExternalStore(
    subscribe,
    readAnalyticsChoice,
    serverChoice,
  );
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const currentChoice = failed ? "denied" : stored;
  const isVisible =
    analyticsPage(pathname) !== undefined || pathname === "/privacy";
  function choose(value: AnalyticsChoice) {
    if (value === "denied") stopAnalytics();
    const isSaved = saveAnalyticsChoice(value);
    if (!isSaved) stopAnalytics();
    setFailed(!isSaved);
    window.dispatchEvent(new Event("storage"));
    setOpen(!isSaved);
    // A full reload removes all vendor listeners after withdrawal of consent.
    if (currentChoice !== "denied" && value === "denied" && isSaved)
      window.location.reload();
  }
  return (
    <>
      {currentChoice !== "denied" && analyticsPage(pathname) !== undefined ? (
        <AnalyticsEnabled />
      ) : null}
      {isVisible ? (
        <aside
          aria-label={t("title")}
          className={
            open
              ? "fixed inset-x-3 bottom-3 z-50 ms-auto max-w-md rounded-2xl border bg-card p-4 text-card-foreground shadow-lg sm:inset-x-6 sm:bottom-6"
              : "fixed end-3 bottom-3 z-50 rounded-xl border bg-card text-card-foreground sm:end-6 sm:bottom-6"
          }
        >
          {open ? (
            <>
              <h2 className="font-semibold">{t("title")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("description")}
              </p>
              {failed ? (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {t("unavailable")}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    choose("denied");
                  }}
                >
                  {t("decline")}
                </Button>
                <Button
                  onClick={() => {
                    choose("granted");
                  }}
                >
                  {t("accept")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  {t("close")}
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(true);
              }}
            >
              {t("settings")}
            </Button>
          )}
        </aside>
      ) : null}
    </>
  );
}
