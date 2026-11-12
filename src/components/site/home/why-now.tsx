import {
  type LucideIcon,
  ScrollTextIcon,
  SmartphoneIcon,
  UsersIcon,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import materialStudy from "../../../../public/images/material-study.webp";
import { Container } from "../container";
import { SectionHeading } from "../section-heading";

/** Three shifts in India that make this the moment — no invented numbers. */
const reasons = [
  { key: "epr", icon: ScrollTextIcon },
  { key: "informal", icon: UsersIcon },
  { key: "upi", icon: SmartphoneIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

export async function WhyNow() {
  const t = await getTranslations("home.whyNow");

  return (
    <section
      aria-labelledby="why-now-heading"
      className="border-t py-10 sm:py-12 lg:py-24"
    >
      <Container className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="why-now-heading"
            title={t("heading")}
            intro={t("intro")}
          />
          <div
            data-parallax-scene
            className="relative overflow-hidden bg-muted"
          >
            <Image
              data-parallax="-24"
              src={materialStudy}
              alt=""
              width={1440}
              height={960}
              sizes="(min-width: 1024px) 480px, 100vw"
              className="h-auto w-full"
            />
          </div>
        </div>
        <ul className="grid">
          {reasons.map(({ key, icon: Icon }) => (
            <li
              key={key}
              data-reveal
              className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-5 gap-y-3 border-t border-border py-7"
            >
              <span className="row-span-2 flex size-11 items-start justify-center pt-1 text-foreground">
                <Icon aria-hidden className="size-5" />
              </span>
              <h3 className="text-xl font-semibold tracking-tight">
                {t(`${key}.title`)}
              </h3>
              <p className="col-start-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t(`${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
