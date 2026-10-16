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

import recyclingLine from "../../../../public/images/showcase/recycling-line.webp";
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
      className="overflow-hidden bg-muted/30 py-10 text-foreground sm:py-12 lg:py-16"
    >
      <Container className="space-y-6 lg:space-y-8">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-16">
          <h2
            id="material-records-heading"
            className="max-w-3xl font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl lg:text-5xl"
          >
            {home("expansion.recordsTitle")}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            {how("body")}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <div
            data-parallax-scene
            className="relative min-h-72 overflow-hidden sm:min-h-96"
          >
            <Image
              data-parallax="16"
              src={recyclingLine}
              alt=""
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
            />
          </div>
          <dl className="space-y-2">
            {facts.map(({ key, icon: Icon }) => (
              <div
                key={key}
                data-reveal
                className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1 py-5"
              >
                <Icon aria-hidden className="row-span-2 mt-1 size-5" />
                <dt className="text-lg font-semibold">{ledger(key)}</dt>
                <dd className="col-start-2 text-sm leading-relaxed text-muted-foreground">
                  {ledger(`${key}Body`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">
              {principles("frozen.title")}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {principles("frozen.body")}
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">{help("carbonCredits.q")}</h3>
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
