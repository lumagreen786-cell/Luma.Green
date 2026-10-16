"use client";

import {
  BookCheckIcon,
  ClockIcon,
  MapPinIcon,
  ScaleIcon,
  UserCheckIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

const FACTS = [
  { key: "who", icon: UserCheckIcon },
  { key: "when", icon: ClockIcon },
  { key: "where", icon: MapPinIcon },
  { key: "what", icon: ScaleIcon },
] as const;

/**
 * Why the numbers above can back a credit later: each kilo carries who,
 * when, where and what — the evidence carbon and plastic-credit standards
 * ask for.
 */
export function LedgerExplainer() {
  const t = useTranslations("impact.ledger");
  const headingId = useId();

  return (
    <details
      aria-labelledby={headingId}
      className="flex flex-col gap-4 border-t border-border py-6"
    >
      <summary className="flex min-h-11 cursor-pointer items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
          <BookCheckIcon aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-foreground">{t("lead")}</p>
        </div>
      </summary>
      <dl className="grid gap-3 sm:grid-cols-2">
        {FACTS.map(({ key, icon: Icon }) => (
          <div key={key} className="flex gap-3 border-t border-border py-4">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="flex flex-col gap-0.5">
              <dt className="font-medium">{t(key)}</dt>
              <dd className="text-sm text-muted-foreground">
                {t(`${key}Body`)}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </details>
  );
}
