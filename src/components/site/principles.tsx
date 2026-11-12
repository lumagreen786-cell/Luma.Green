import {
  LockIcon,
  type LucideIcon,
  ScaleIcon,
  ScrollTextIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Container } from "./container";
import { SectionHeading } from "./section-heading";

const principles = [
  { key: "auditable", icon: ScrollTextIcon },
  { key: "exact", icon: ScaleIcon },
  { key: "frozen", icon: LockIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

/** The three ledger guarantees from AGENTS.md §1, in user-facing words. */
export async function Principles() {
  const t = await getTranslations("principles");

  return (
    <section
      aria-labelledby="principles-heading"
      className="py-10 sm:py-12 lg:py-24"
    >
      <Container className="space-y-12">
        <SectionHeading
          id="principles-heading"
          title={t("heading")}
          intro={t("intro")}
        />
        <ul className="grid grid-flow-dense divide-y border-y md:grid-cols-3 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
          {principles.map(({ key, icon: Icon }) => (
            <li data-reveal key={key} className="space-y-5 py-7 md:px-7">
              <span className="inline-flex size-8 items-center text-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="text-xl font-semibold tracking-tight">
                {t(`${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
