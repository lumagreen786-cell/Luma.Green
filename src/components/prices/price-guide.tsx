import {
  ArrowRightIcon,
  CalculatorIcon,
  PackageIcon,
  ReceiptTextIcon,
  ScaleIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { RoleStoryImage } from "@/components/showcase/role-story-image";
import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const weighingSteps = [
  { key: "zero", icon: ScaleIcon },
  { key: "each", icon: PackageIcon },
  { key: "amount", icon: CalculatorIcon },
  { key: "receipt", icon: ReceiptTextIcon },
] as const;

/** The board is a price reference; measured weight still determines payment. */
export function PriceGuide() {
  const help = useTranslations("help");
  const prices = useTranslations("prices");
  const sell = useTranslations("sell");
  return (
    <section
      aria-labelledby="price-guide-heading"
      className="grid min-w-0 gap-4 border-t pt-4"
    >
      <div className="min-w-0 space-y-5">
        <RoleStoryImage
          scene="sorting"
          frameClassName="aspect-[3/2] rounded-lg"
          sizes="(min-width: 1024px) 264px, (min-width: 640px) calc(100vw - 104px), calc(100vw - 80px)"
        />
        <p className="max-w-prose text-base leading-relaxed">
          {prices("floorHelp")}
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {sell("basket.weighNote")}
        </p>
      </div>
      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <h2
            id="price-guide-heading"
            className="font-display text-lg font-semibold tracking-tight text-balance"
          >
            {help("guides.weighingAtDoor.title")}
          </h2>
          <p className="text-muted-foreground">
            {help("guides.weighingAtDoor.summary")}
          </p>
        </div>
        <ol className="divide-y border-y">
          {weighingSteps.map(({ key: step, icon: Icon }) => (
            <li key={step} className="space-y-1 py-4">
              <h3 className="flex items-start gap-2 font-semibold">
                <Icon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-foreground"
                />
                {help(`guides.weighingAtDoor.steps.${step}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {help(`guides.weighingAtDoor.steps.${step}.body`)}
              </p>
            </li>
          ))}
        </ol>
        <Button asChild variant="outline" size="lg">
          <Link
            href="/help/household/weighing-at-door"
            aria-label={actionName(
              help("training.openGuide"),
              help("guides.weighingAtDoor.title"),
            )}
          >
            {help("training.openGuide")}
            <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
