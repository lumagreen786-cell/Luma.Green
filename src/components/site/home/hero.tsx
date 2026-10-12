import { ArrowRightIcon, MapPinIcon, MoveUpRightIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import preparation from "../../../../public/images/showcase/household-preparation.webp";
import { Container } from "../container";
import { PriceTeaser } from "./price-teaser";

/** Start with a household's next action; industry has its own clear entry. */
export async function HomeHero() {
  const [t, nav, steps] = await Promise.all([
    getTranslations("home.hero"),
    getTranslations("nav"),
    getTranslations("sell.steps"),
  ]);
  return (
    <section aria-labelledby="hero-heading" className="border-b bg-background">
      <Container className="pt-8 sm:pt-10 lg:pt-12">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-12">
          <div className="flex min-w-0 flex-col items-start gap-5 lg:py-4">
            <h1
              id="hero-heading"
              className="max-w-xl font-display text-[clamp(2.5rem,4.4vw,4.5rem)] leading-[1.08] font-semibold tracking-tight text-balance"
            >
              {t("title")}
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
              {t("lead")}
            </p>
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPinIcon aria-hidden className="size-4 text-primary" />
              {t("eyebrow")}
            </p>
            <div className="flex w-full min-w-0 flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild size="lg" className="max-w-full">
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
                variant="ghost"
                size="lg"
                className="max-w-full px-0 sm:px-4"
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
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("join")}
              <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
            </Link>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-muted lg:aspect-[5/4]">
            <Image
              src={preparation}
              alt=""
              fill
              preload
              sizes="(min-width: 1280px) 570px, (min-width: 1024px) 46vw, 100vw"
              className="object-cover object-[48%_50%]"
            />
          </div>
        </div>
        <ol
          aria-label={steps("label")}
          className="mt-8 grid grid-cols-2 gap-x-6 border-t py-3 sm:mt-10 sm:grid-cols-4 sm:gap-x-8 sm:py-4"
        >
          {(["basket", "shop", "when", "confirm"] as const).map(
            (step, index) => (
              <li
                key={step}
                className="flex min-w-0 items-center gap-3 py-3 text-sm font-medium"
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full bg-primary/30"
                />
                <span className="min-w-0">{steps(step)}</span>
                {index < 3 ? (
                  <ArrowRightIcon
                    aria-hidden
                    className="ms-auto hidden size-4 shrink-0 text-muted-foreground sm:block rtl:rotate-180"
                  />
                ) : null}
              </li>
            ),
          )}
        </ol>
      </Container>
      <div className="border-t bg-muted/30">
        <Container className="py-5 sm:py-6">
          <PriceTeaser />
        </Container>
      </div>
    </section>
  );
}
