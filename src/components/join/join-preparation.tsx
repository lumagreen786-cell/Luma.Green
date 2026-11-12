import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { RoleStoryImage } from "@/components/showcase/role-story-image";
import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const businessChecks = ["one", "two", "three"] as const;

/** Public context for the business review, before any private document upload. */
export function JoinPreparation() {
  const join = useTranslations("join");
  const help = useTranslations("help");
  return (
    <section
      aria-labelledby="join-preparation-heading"
      className="grid gap-6 py-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12 lg:py-6"
    >
      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <h2
            id="join-preparation-heading"
            className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl"
          >
            {join("status.submitted.whatWeCheck")}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            {help("guides.verifyBusiness.summary")}
          </p>
        </div>
        <ul className="divide-y border-y">
          {businessChecks.map((check) => (
            <li key={check} className="flex gap-3 py-4">
              <CheckIcon
                aria-hidden
                className="mt-0.5 size-5 shrink-0 text-foreground"
              />
              <span className="text-sm leading-relaxed">
                {join(`status.checks.business.${check}`)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {join("consent.privacy")}
        </p>
        <Button asChild variant="outline" size="lg">
          <Link
            href="/help/yard/verify-business"
            aria-label={actionName(
              help("training.openGuide"),
              help("guides.verifyBusiness.title"),
            )}
          >
            {help("training.openGuide")}
            <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
          </Link>
        </Button>
      </div>
      <RoleStoryImage
        scene="electronics"
        sizes="(min-width: 1280px) 512px, (min-width: 1024px) 45vw, (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
        frameClassName="aspect-[3/2] lg:aspect-[4/5]"
      />
    </section>
  );
}
