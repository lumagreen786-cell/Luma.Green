import { CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RoleStoryImage } from "@/components/showcase/role-story-image";
import { ClosingCta } from "@/components/site/closing-cta";
import { Container } from "@/components/site/container";
import { loopSteps } from "@/components/site/content";
import { PageHeader } from "@/components/site/page-header";
import { SortingGuide } from "@/components/site/sorting-guide";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "howItWorks" });

  return pageMetadata({
    locale,
    path: "/how-it-works",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const storyRoles = {
  sell: "preparation",
  trade: "dispatch",
  record: "pellets",
} as const;

const points = ["point1", "point2", "point3"] as const;

export default async function HowItWorksPage() {
  const [t, loop] = await Promise.all([
    getTranslations("howItWorks"),
    getTranslations("loop"),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        lead={t("lead")}
        scene="sorting"
        atmosphere
      />

      <Container className="pb-8">
        <ol className="grid gap-4">
          {loopSteps.map(({ key, icon: Icon }, index) => (
            <li
              key={key}
              data-reveal
              aria-labelledby={`step-${key}`}
              className="grid min-w-0 gap-5 rounded-xl bg-card p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
            >
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
                <span className="row-span-2 inline-flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Icon aria-hidden className="size-6" />
                </span>
                <p className="text-sm font-medium text-primary">
                  {t("stepLabel", { number: index + 1 })}
                </p>
                <h2
                  id={`step-${key}`}
                  className="font-display text-lg font-semibold tracking-tight"
                >
                  {loop(`${key}.title`)}
                </h2>
                <RoleStoryImage
                  scene={storyRoles[key]}
                  className="col-span-2 mt-2 w-full"
                  frameClassName="h-40 aspect-auto"
                />
              </div>
              <div className="space-y-4 lg:self-center">
                <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                  {t(`${key}.body`)}
                </p>
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    {loop(`${key}.title`)}
                  </summary>
                  <ul className="grid gap-4 border-t border-border pt-4">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <CheckIcon
                          aria-hidden
                          className="mt-0.5 size-5 shrink-0 text-primary"
                        />
                        <span>{t(`${key}.${point}`)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </li>
          ))}
        </ol>
      </Container>

      <SortingGuide />

      <div>
        <ClosingCta />
      </div>
    </>
  );
}
