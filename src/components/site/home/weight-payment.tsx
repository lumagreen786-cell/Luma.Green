import {
  ArrowRightIcon,
  BanknoteIcon,
  ReceiptTextIcon,
  ScaleIcon,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import weighing from "../../../../public/images/showcase/kabadiwala-weighing.webp";
import { Container } from "../container";
import { SectionHeading } from "../section-heading";

const points = [
  { key: "each", icon: ScaleIcon },
  { key: "pay", icon: BanknoteIcon },
  { key: "receipt", icon: ReceiptTextIcon },
] as const;

/** Explain the estimate-to-measured-payment boundary without showing fake totals. */
export async function WeightPayment() {
  const [home, help, sell] = await Promise.all([
    getTranslations("home"),
    getTranslations("help"),
    getTranslations("sell"),
  ]);
  return (
    <section
      aria-labelledby="weight-payment-heading"
      className="border-b py-10 sm:py-12 lg:py-24"
    >
      <Container className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted lg:aspect-4/5">
          <Image
            src={weighing}
            alt=""
            fill
            sizes="(min-width: 1024px) 480px, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <SectionHeading
            id="weight-payment-heading"
            title={home("expansion.paymentTitle")}
            intro={sell("basket.weighNote")}
          />
          <ol className="divide-y border-y">
            {points.map(({ key, icon: Icon }) => (
              <li key={key} data-reveal className="flex gap-5 py-6">
                <Icon
                  aria-hidden
                  className="mt-1 size-6 shrink-0 text-foreground"
                />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    {help(`guides.weighingAtDoor.steps.${key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {help(`guides.weighingAtDoor.steps.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="min-h-12 max-w-full min-w-0 self-start py-3 text-start whitespace-nowrap"
          >
            <Link
              href="/help/household/weighing-at-door"
              aria-label={actionName(
                help("training.openGuide"),
                help("guides.weighingAtDoor.title"),
              )}
            >
              <span className="sm:hidden">{help("training.openGuide")}</span>
              <span className="hidden sm:inline">
                {help("guides.weighingAtDoor.title")}
              </span>
              <ArrowRightIcon aria-hidden className="shrink-0 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
