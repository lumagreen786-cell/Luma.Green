"use client";

import {
  BellIcon,
  type LucideIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";

import { StatusPill } from "@/components/app/page-parts";
import { cn } from "@/lib/utils";

import type { ComplianceRecord, Consent } from "./types";
import { useLongDate } from "./use-long-date";

type Tone = "good" | "warn" | "bad";

const LOOK: Record<Tone, { card: string; badge: string; icon: LucideIcon }> = {
  good: {
    card: "border-primary bg-card",
    badge: "bg-primary/10 text-primary",
    icon: ShieldCheckIcon,
  },
  warn: {
    card: "border-accent bg-card",
    badge: "bg-accent text-accent-foreground",
    icon: ShieldAlertIcon,
  },
  bad: {
    card: "border-destructive/40 bg-destructive/5",
    badge: "bg-background text-destructive",
    icon: ShieldXIcon,
  },
};

function Frame({
  tone,
  title,
  subtitle,
  children,
}: {
  tone: Tone;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const { card, badge, icon: Icon } = LOOK[tone];
  return (
    <section
      aria-labelledby={headingId}
      role={tone === "good" ? undefined : "alert"}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-s-2 p-5 sm:p-6",
        card,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            badge,
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="text-lg font-semibold">
            {title}
          </h2>
          {subtitle ? <p className="text-sm break-words">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * The pollution-board consent: how long it has left, and the reminder. A
 * small scrap shop with none on file sees nothing — it rarely needs one.
 */
export function ConsentCard({
  consent,
  orgKind,
}: {
  consent: Consent;
  orgKind: ComplianceRecord["orgKind"];
}) {
  const t = useTranslations("compliance");
  const longDate = useLongDate();
  const { status, validUntil, board = "", number = "", daysLeft = 0 } = consent;

  if (status === "missing" || !validUntil) {
    if (orgKind === "kabadiwala") return null;
    return (
      <Frame tone="warn" title={t("consent.missingTitle")}>
        <p className="text-sm">{t("consent.missingBody")}</p>
      </Frame>
    );
  }

  const date = longDate(validUntil);
  const subtitle = t("items.consent.detail", { board, number });

  if (status === "expired") {
    return (
      <Frame tone="bad" title={t("consent.expiredTitle")} subtitle={subtitle}>
        <p className="text-sm">{t("consent.expiredBody", { date, board })}</p>
        <StatusPill tone="bad">
          {t("consent.ranOut", { days: -daysLeft })}
        </StatusPill>
      </Frame>
    );
  }

  const isExpiring = status === "expiring";
  return (
    <Frame
      tone={isExpiring ? "warn" : "good"}
      title={t(isExpiring ? "consent.expiringTitle" : "consent.title")}
      subtitle={subtitle}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-semibold tracking-tight">
          {t("consent.validUntil", { date })}
        </p>
        <StatusPill tone={isExpiring ? "warn" : "good"}>
          {t("consent.daysLeft", { days: daysLeft })}
        </StatusPill>
      </div>
      {isExpiring ? (
        <p className="text-sm">{t("consent.expiringBody", { date, board })}</p>
      ) : null}
      {consent.remindOn ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <BellIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("consent.reminder", { date: longDate(consent.remindOn) })}
        </p>
      ) : null}
    </Frame>
  );
}
