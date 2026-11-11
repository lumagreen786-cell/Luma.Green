import {
  ArrowRightIcon,
  ClipboardListIcon,
  ScaleIcon,
  TagIcon,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { Container } from "../container";
import { SectionHeading } from "../section-heading";

/** Three real shop tasks, with the hand-off from household receipt to stock. */
export async function ShopWorkday() {
  const [home, help, participants, nav] = await Promise.all([
    getTranslations("home"),
    getTranslations("help"),
    getTranslations("participants"),
    getTranslations("nav"),
  ]);
  const tasks = [
    {
      icon: ClipboardListIcon,
      title: help("guides.pickupRequests.steps.see.title"),
      body: help("guides.pickupRequests.steps.see.body"),
    },
    {
      icon: ScaleIcon,
      title: help("guides.weighAndPay.title"),
      body: help("guides.weighAndPay.steps.save.body"),
    },
    {
      icon: TagIcon,
      title: help("guides.setPrices.title"),
      body: help("guides.setPrices.steps.history.body"),
    },
  ];
  return (
    <section
      aria-labelledby="shop-workday-heading"
      className="bg-background py-6 sm:py-8"
    >
      <Container className="space-y-5">
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-8">
          <SectionHeading
            id="shop-workday-heading"
            title={home("expansion.shopTitle")}
            intro={participants("kabadiwala.body")}
          />
          <div className="flex min-w-0 flex-wrap gap-3 lg:justify-end">
            <Button
              asChild
              size="lg"
              className="min-h-12 max-w-full min-w-0 py-3 text-start whitespace-nowrap"
            >
              <Link
                href="/join/kabadiwala"
                aria-label={actionName(
                  nav("join"),
                  home("roles.kabadiwala.cta"),
                )}
              >
                <span className="xl:hidden">{nav("join")}</span>
                <span className="hidden xl:inline">
                  {home("roles.kabadiwala.cta")}
                </span>
                <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-12 max-w-full min-w-0 py-3 text-start whitespace-nowrap"
            >
              <Link
                href="/help/kabadiwala"
                aria-label={actionName(
                  nav("help"),
                  help("roles.kabadiwala.title"),
                )}
              >
                <span className="xl:hidden">{nav("help")}</span>
                <span className="hidden xl:inline">
                  {help("roles.kabadiwala.title")}
                </span>
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div
            data-parallax-scene
            className="relative aspect-[2/1] overflow-hidden rounded-xl bg-muted lg:order-2 lg:aspect-auto"
          >
            <Image
              data-parallax="-20"
              src="/images/showcase/material-yard.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 420px, 100vw"
              className="object-cover object-center"
            />
          </div>
          <ol className="min-w-0 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            {tasks.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                data-reveal
                className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 gap-y-1 p-5 sm:p-6"
              >
                <Icon
                  aria-hidden
                  className="row-span-2 size-11 rounded-full bg-secondary/35 p-2.5 text-primary"
                />
                <h3 className="font-display text-base font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="col-start-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
