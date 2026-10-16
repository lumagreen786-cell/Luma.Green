import { ArrowRightIcon, CheckIcon } from "lucide-react";
import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";

import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import householdSorting from "../../../../public/images/showcase/household-sorting.webp";
import { Container } from "../container";
import { SectionHeading } from "../section-heading";

/** Manual selection is the starting path; photo estimation remains optional. */
export async function PickupJourney() {
  const [home, sell, help, how, format, nav] = await Promise.all([
    getTranslations("home"),
    getTranslations("sell"),
    getTranslations("help"),
    getTranslations("howItWorks.sell"),
    getFormatter(),
    getTranslations("nav"),
  ]);
  const steps = [
    { title: sell("basket.title"), body: sell("basket.lead") },
    { title: sell("shop.title"), body: sell("shop.lead") },
    {
      title: help("guides.firstPickup.steps.slot.title"),
      body: help("guides.firstPickup.steps.slot.body"),
    },
    { title: sell("confirm.title"), body: sell("confirm.phoneLead") },
  ];

  return (
    <section
      aria-labelledby="pickup-heading"
      className="py-10 sm:py-12 lg:py-16"
    >
      <Container className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex min-w-0 flex-col gap-8">
          <SectionHeading
            id="pickup-heading"
            title={home("expansion.pickupTitle")}
            intro={how("body")}
          />
          <ol className="divide-y border-y">
            {steps.map((step, index) => (
              <li
                key={step.title}
                data-reveal
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-5 py-4"
              >
                <span className="pt-1 font-mono text-sm text-primary">
                  {format.number(index + 1, { minimumIntegerDigits: 2 })}
                </span>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex min-w-0 flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="min-h-12 max-w-full min-w-0 py-3 text-start whitespace-nowrap"
            >
              <Link
                href="/sell"
                aria-label={actionName(nav("sellScrap"), home("hero.sell"))}
              >
                <span className="sm:hidden">{nav("sellScrap")}</span>
                <span className="hidden sm:inline">{home("hero.sell")}</span>
                <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-h-12 max-w-full min-w-0 py-3 text-start whitespace-nowrap"
            >
              <Link href="/help/household/first-pickup">
                <span className="min-w-0">{help("training.openGuide")}</span>
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:pt-3">
          <div
            data-parallax-scene
            className="relative aspect-[4/3] overflow-hidden bg-muted lg:aspect-4/5"
          >
            <Image
              data-parallax="16"
              src={householdSorting}
              alt=""
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>
          <ul className="flex min-w-0 flex-col gap-3">
            {(["one", "two", "three"] as const).map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-sm text-muted-foreground"
              >
                <CheckIcon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                {home(`roles.household.${point}`)}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
