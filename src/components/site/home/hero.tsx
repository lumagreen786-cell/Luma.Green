import { ArrowRightIcon, MapPinIcon, MoveUpRightIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import preparation from "../../../../public/images/showcase/recycle-household-illustration.webp";
import { Container } from "../container";
import { PriceTeaser } from "./price-teaser";

/** A direct recycling action beside a household preparation scene. */
export async function HomeHero() {
  const [t, nav] = await Promise.all([
    getTranslations("home.hero"),
    getTranslations("nav"),
  ]);
  return (
    <section aria-labelledby="hero-heading" className="bg-background">
      <Container className="py-6 sm:py-10">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
          <div className="order-1 flex min-w-0 flex-col items-start gap-4 py-2 lg:justify-center">
            <div className="grid min-w-0 gap-3 pb-5">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPinIcon aria-hidden className="size-4 text-primary" />
                {t("eyebrow")}
              </p>
              <h1
                id="hero-heading"
                className="max-w-6xl font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] font-semibold tracking-tight text-balance"
              >
                {t("title")}
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                {t("lead")}
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                asChild
                size="lg"
                className="w-full max-w-full justify-between gap-4 sm:w-auto"
              >
                <Link
                  href="/sell"
                  aria-label={actionName(nav("sellScrap"), t("sell"))}
                >
                  {t("sell")}
                  <ArrowRightIcon
                    aria-hidden
                    className="size-5 rtl:rotate-180"
                  />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full max-w-full justify-between gap-4 sm:w-auto"
              >
                <Link href="/prices">
                  {t("prices")}
                  <MoveUpRightIcon
                    aria-hidden
                    className="size-4 rtl:-scale-x-100"
                  />
                </Link>
              </Button>
            </div>
            <Link
              href="/join"
              className="inline-flex min-h-11 items-center gap-3 text-sm font-medium underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("join")}
              <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
            </Link>
          </div>
          <div className="relative order-2 aspect-[3/2] min-w-0 overflow-hidden bg-muted">
            <Image
              src={preparation}
              alt=""
              fill
              preload
              sizes="(min-width: 1280px) 568px, (min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>
      <div className="bg-muted/30">
        <Container className="py-5 sm:py-6">
          <PriceTeaser />
        </Container>
      </div>
    </section>
  );
}
