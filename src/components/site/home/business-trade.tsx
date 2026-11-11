import { ArrowRightIcon, CheckIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { actionName } from "../action-name";
import { Container } from "../container";

/** Business trade claims stay bounded by recorded dispatch and payment status. */
export async function BusinessTrade() {
  const [roles, trade, join] = await Promise.all([
    getTranslations("home.roles"),
    getTranslations("howItWorks.trade"),
    getTranslations("join"),
  ]);
  return (
    <section
      aria-labelledby="business-trade-heading"
      className="bg-background py-6 sm:py-8"
    >
      <Container>
        <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-border/60 bg-card lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <div className="relative aspect-[2/1] min-w-0 overflow-hidden bg-muted lg:aspect-auto">
            <Image
              src="/images/showcase/recycle-chain-illustration.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 568px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 space-y-5 p-5 [overflow-wrap:anywhere] sm:p-8">
            <h2
              id="business-trade-heading"
              className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-3xl"
            >
              {roles("manufacturer.one")}
            </h2>
            <ul className="divide-y divide-border/60">
              {(["point1", "point2", "point3"] as const).map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 py-3 text-sm leading-relaxed"
                >
                  <CheckIcon
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-primary"
                  />
                  <span className="min-w-0">{trade(point)}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {trade("body")}
            </p>
            <Button asChild size="lg">
              <Link
                href="/join/manufacturer"
                aria-label={actionName(
                  join("start"),
                  roles("manufacturer.cta"),
                )}
              >
                {join("start")}
                <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
