"use client";

import {
  HardHatIcon,
  type LucideIcon,
  ReceiptTextIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Section, StatusPill } from "@/components/app/page-parts";
import { cn } from "@/lib/utils";

import type { CheckItem, ComplianceRecord } from "./types";

const ICONS: Record<CheckItem["id"], LucideIcon> = {
  gst: ReceiptTextIcon,
  consent: ShieldCheckIcon,
  scale: ScaleIcon,
  safety: HardHatIcon,
};

type Tone = "neutral" | "good" | "warn" | "bad";

const TONES: Record<CheckItem["status"], Tone> = {
  done: "good",
  due_soon: "warn",
  overdue: "bad",
  missing: "bad",
  optional: "neutral",
  not_needed: "neutral",
  self_declared: "neutral",
};

const BADGES: Record<Tone, string> = {
  good: "bg-primary/10 text-primary",
  warn: "bg-accent text-accent-foreground",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

/** The line under an item's title: the number on file, or what's missing. */
function useDetail(record: ComplianceRecord) {
  const t = useTranslations("compliance.items");
  return (id: CheckItem["id"]): string => {
    switch (id) {
      case "gst": {
        return record.gstin
          ? t("gst.registered", { gstin: record.gstin })
          : t("gst.notRegistered");
      }
      case "consent": {
        const { board, number } = record.consent;
        return board && number
          ? t("consent.detail", { board, number })
          : t("consent.missing");
      }
      case "scale":
      case "safety": {
        return t(`${id}.detail`);
      }
    }
  };
}

/**
 * What a business needs to trade legally, with where it stands on each and
 * a plain note on what the item means.
 */
export function Checklist({ record }: { record: ComplianceRecord }) {
  const t = useTranslations("compliance");
  const detail = useDetail(record);
  const isShop = record.orgKind === "kabadiwala";

  return (
    <Section title={t("checklist.title")}>
      <ul className="flex flex-col gap-3">
        {record.checklist.map((item) => {
          const Icon = ICONS[item.id];
          const tone = TONES[item.status];
          const note = t(
            isShop && item.id === "consent"
              ? "items.consent.noteShop"
              : `items.${item.id}.note`,
          );
          return (
            <li
              key={item.id}
              className="flex gap-3 border-b border-border py-4"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  BADGES[tone],
                )}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{t(`items.${item.id}.title`)}</h3>
                  <StatusPill tone={tone}>
                    {t(`status.${item.status}`)}
                  </StatusPill>
                </div>
                <p className="text-sm break-words">{detail(item.id)}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t("checklist.whatThisMeans")}
                  </span>{" "}
                  {note}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
