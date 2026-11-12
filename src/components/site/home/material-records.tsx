import {
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  ScaleIcon,
  UserCheckIcon,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { Container } from "../container";

const facts = [
  { key: "who", icon: UserCheckIcon },
  { key: "what", icon: ScaleIcon },
  { key: "when", icon: ClockIcon },
  { key: "where", icon: MapPinIcon },
] as const;

/** Traceability is implemented; credit issuance and real escrow are future gates. */
export async function MaterialRecords() {
  const [home, ledger, how, principles, help, footer] = await Promise.all([
    getTranslations("home"),
    getTranslations("impact.ledger"),
    getTranslations("howItWorks.record"),
    getTranslations("principles"),
    getTranslations("help.faqs"),
    getTranslations("footer"),
  ]);
  return (
    <section
      aria-labelledby="material-records-heading"
      className="bg-background py-6 text-foreground sm:py-8"
    >
      <Container className="space-y-5 pb-6">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-16">
          <h2
            id="material-records-heading"
            className="max-w-3xl font-display text-2xl leading-tight font-normal tracking-tight text-balance sm:text-3xl"
          >
            {home("expansion.recordsTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {how("body")}
          </p>
        </div>
        <div className="relative aspect-[3/1] overflow-hidden rounded-panel bg-muted sm:aspect-[5/1]">
          <Image
            src="/images/showcase/recycling-line.webp"
            alt=""
            fill
            sizes="(min-width: 1280px) 1152px, 100vw"
            className="object-cover"
          />
        </div>
        <dl className="grid gap-px overflow-hidden rounded-panel border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(({ key, icon: Icon }) => (
            <div
              key={key}
              data-reveal
              className="flex min-w-0 flex-col items-start gap-3 bg-card p-5 sm:p-6"
            >
              <Icon
                aria-hidden
                className="size-12 rounded-full bg-secondary/35 p-3 text-foreground"
              />
              <dt className="text-lg font-semibold">{ledger(key)}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                {ledger(`${key}Body`)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-panel border border-border/60 bg-card p-5">
            <h3 className="text-base font-semibold">
              {principles("frozen.title")}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {principles("frozen.body")}
            </p>
          </div>
          <div className="space-y-2 rounded-panel border border-border/60 bg-card p-5">
            <h3 className="text-base font-semibold">
              {help("carbonCredits.q")}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {help("carbonCredits.a")}
            </p>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="min-h-12 max-w-full min-w-0 py-3 text-start whitespace-nowrap"
        >
          <Link href="/standards">
            <span className="min-w-0">{footer("standards")}</span>
            <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
          </Link>
        </Button>
      </Container>
    </section>
  );
}
