import {
  ArrowRightIcon,
  CameraIcon,
  ChartNoAxesCombinedIcon,
  MapPinIcon,
  ScaleIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { Container } from "../container";
import { RecyclingIllustration } from "./recycling-illustration";

/** Public task dashboard. No fabricated personal activity or live totals. */
export async function HomeHero() {
  const [t, nav, sell, help, prices, roles, format] = await Promise.all([
    getTranslations("home.hero"),
    getTranslations("nav"),
    getTranslations("sell.simple"),
    getTranslations("help.guides"),
    getTranslations("prices"),
    getTranslations("home.roles"),
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
      <Container className="space-y-5 py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <MapPinIcon aria-hidden className="size-4" />
              {t("eyebrow")}
            </div>
            <h1
              id="hero-heading"
              className="font-display text-4xl leading-tight font-normal tracking-tight text-foreground sm:text-[3.25rem]"
            >
              {t("title")}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("lead")}
            </p>
          </div>
          <Button asChild className="gap-3">
            <Link
              href="/sell"
              aria-label={actionName(nav("sellScrap"), t("sell"))}
            >
              {t("sell")}
              <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
          <div className="relative min-h-64 overflow-hidden rounded-panel bg-card sm:min-h-80">
            <RecyclingIllustration />
            <div className="absolute inset-0 bg-image-scrim/45" />
            <div className="relative flex h-full min-h-64 flex-col justify-end gap-4 p-6 text-white sm:min-h-80 sm:p-8">
              <span className="w-fit rounded-full border border-white/30 bg-black/20 px-3 py-1.5 text-sm text-white">
                {nav("sellScrap")}
              </span>
              <p className="max-w-sm font-display text-3xl leading-tight font-normal text-white sm:text-4xl">
                {roles("household.two")}
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-white/90">
                {roles("household.one")}
              </p>
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              href="/prices"
              aria-label={actionName(nav("prices"), t("prices"))}
              className="group flex min-w-0 flex-col items-start gap-3 rounded-panel bg-card p-6 shadow-panel outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <div className="flex w-full items-center justify-between">
                <ChartNoAxesCombinedIcon
                  aria-hidden
                  className="size-11 rounded-full bg-muted p-3"
                />
                <ArrowRightIcon aria-hidden className="size-5 rtl:rotate-180" />
              </div>
              <h2 className="font-display text-2xl font-normal text-foreground">
                {t("prices")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {prices("lead")}
              </p>
            </Link>
            <Link
              href="/join"
              aria-label={t("join")}
              className="record-detail flex min-w-0 flex-col items-start gap-3 rounded-panel p-6 outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <div className="flex w-full items-center justify-between">
                <UsersIcon
                  aria-hidden
                  className="size-11 rounded-full bg-muted p-3"
                />
                <ArrowRightIcon aria-hidden className="size-5 rtl:rotate-180" />
              </div>
              <h2 className="font-display text-2xl font-normal text-foreground">
                {t("join")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {roles("intro")}
              </p>
            </Link>
          </div>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <li
              key={title}
              className="flex min-w-0 items-start gap-3 rounded-panel bg-card p-5 shadow-panel"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              >
                {format.number(index + 1, { minimumIntegerDigits: 2 })}
              </span>
              <div className="min-w-0 space-y-1">
                <h2 className="text-base font-medium text-foreground">
                  {title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
              <Icon
                aria-hidden
                className="ms-auto size-5 shrink-0 text-muted-foreground"
              />
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
