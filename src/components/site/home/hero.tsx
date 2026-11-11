import {
  ArrowRightIcon,
  CameraIcon,
  MapPinIcon,
  MoveUpRightIcon,
  ScaleIcon,
  TruckIcon,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { Container } from "../container";
import { PriceTeaser } from "./price-teaser";
import { RecyclingIllustration } from "./recycling-illustration";

/** The route is an explanation of the service, never a simulated live request. */
export async function HomeHero() {
  const [t, nav, sell, help, format] = await Promise.all([
    getTranslations("home.hero"),
    getTranslations("nav"),
    getTranslations("sell.simple"),
    getTranslations("help.guides"),
    getFormatter(),
  ]);
  const steps = [
    { icon: CameraIcon, title: sell("photos"), body: sell("photoHint") },
    {
      icon: TruckIcon,
      title: sell("schedule"),
      body: `${sell("pickup")} / ${sell("dropoff")}`,
    },
    {
      icon: ScaleIcon,
      title: help("weighAndPay.title"),
      body: sell("estimateLater"),
    },
  ];
  return (
    <section aria-labelledby="hero-heading" className="bg-background">
      <Container className="py-4 sm:py-6">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative flex min-w-0 flex-col items-start justify-between gap-8 overflow-hidden rounded-xl bg-sidebar p-6 text-sidebar-foreground sm:p-9 lg:p-10">
            <div className="space-y-5">
              <p className="inline-flex items-center gap-2 rounded-full border border-sidebar-border px-3 py-1.5 text-sm text-sidebar-foreground">
                <MapPinIcon
                  aria-hidden
                  className="size-4 text-sidebar-primary"
                />
                {t("eyebrow")}
              </p>
              <h1
                id="hero-heading"
                className="max-w-xl font-display text-[clamp(2.25rem,4.7vw,4.25rem)] leading-[1.07] font-semibold tracking-tight text-balance text-sidebar-foreground"
              >
                {t("title")}
              </h1>
              <p className="max-w-md text-base leading-relaxed text-sidebar-foreground/80">
                {t("lead")}
              </p>
            </div>
            <div className="w-full min-w-0 space-y-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  size="lg"
                  className="w-full max-w-full justify-between gap-4 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 sm:w-auto"
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
                  className="w-full max-w-full justify-between gap-4 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground sm:w-auto"
                >
                  <Link
                    href="/prices"
                    aria-label={actionName(nav("prices"), t("prices"))}
                  >
                    <span className="sm:hidden">{nav("prices")}</span>
                    <span className="hidden sm:inline">{t("prices")}</span>
                    <MoveUpRightIcon
                      aria-hidden
                      className="size-4 rtl:-scale-x-100"
                    />
                  </Link>
                </Button>
              </div>
              <Link
                href="/join"
                className="inline-flex min-h-11 items-center gap-3 rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-sidebar-ring"
              >
                {t("join")}
                <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="relative aspect-[2/1] overflow-hidden bg-card sm:aspect-[2.3/1] lg:aspect-[2/1]">
              <RecyclingIllustration />
            </div>
            <ol className="divide-y divide-border/60 px-5 sm:px-6">
              {steps.map(({ icon: Icon, title, body }, index) => (
                <li
                  key={title}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 py-4"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-secondary/35 text-secondary-foreground">
                    <Icon aria-hidden className="size-5" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="self-start pt-2 font-mono text-xs text-muted-foreground"
                  >
                    {format.number(index + 1, { minimumIntegerDigits: 2 })}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="mt-4">
          <PriceTeaser />
        </div>
      </Container>
    </section>
  );
}
