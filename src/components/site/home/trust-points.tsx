import {
  LanguagesIcon,
  LockIcon,
  type LucideIcon,
  ReceiptTextIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { locales } from "@/i18n/locales";

import { Container } from "../container";
import { SectionHeading } from "../section-heading";

const points = [
  { key: "verified", icon: ShieldCheckIcon },
  { key: "floor", icon: ScaleIcon },
  { key: "escrow", icon: LockIcon },
  { key: "receipts", icon: ReceiptTextIcon },
  { key: "languages", icon: LanguagesIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

/** The rules that make the platform trustworthy, in plain words. */
export async function TrustPoints() {
  const t = await getTranslations("home.trust");

  return (
    <section
      aria-labelledby="trust-heading"
      className="py-10 sm:py-12 lg:py-24"
    >
      <Container className="relative grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-14">
        <SectionHeading
          id="trust-heading"
          title={t("heading")}
          intro={t("intro")}
        />
        <ul className="divide-y border-y">
          {points.map(({ key, icon: Icon }) => (
            <li data-reveal key={key} className="flex items-start gap-5 py-6">
              <span className="flex size-8 shrink-0 items-center justify-center pt-1 text-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold">
                  {t(`${key}.title`, { count: locales.length })}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
