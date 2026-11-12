import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ContactStrip } from "@/components/help/contact-strip";
import {
  faq,
  findGuide,
  type Guide,
  guidesFor,
  HELP_ROLES,
  type HelpRole,
  isHelpRole,
  ROLE_HELP,
  supportTopicFor,
  TOPIC_ICONS,
} from "@/components/help/content";
import { FaqList } from "@/components/help/faq-list";
import { GuideSteps } from "@/components/help/guide-steps";
import { IconTile } from "@/components/help/help-art";
import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { HelpHero } from "@/components/help/help-hero";
import { HelpSection } from "@/components/help/help-section";
import { Container } from "@/components/site/container";
import { Link } from "@/i18n/navigation";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; role: string; guide: string }>;
}

/** Every guide under every role that lists it, in every locale. */
export function generateStaticParams() {
  return HELP_ROLES.flatMap((role) =>
    guidesFor(role).map(({ slug }) => ({ role, guide: slug })),
  );
}

async function guideFromParams(
  params: Props["params"],
): Promise<{ role: HelpRole; guide: Guide }> {
  const { role, guide: slug } = await params;
  if (!isHelpRole(role)) notFound();
  const guide = findGuide(role, slug);
  if (!guide) notFound();
  return { role, guide };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [locale, { role, guide }] = await Promise.all([
    localeFromParams(params),
    guideFromParams(params),
  ]);
  const t = await getTranslations({ locale, namespace: "help" });

  return pageMetadata({
    locale,
    path: `/help/${role}/${guide.slug}`,
    title: t("guide.metaTitle", {
      guide: t(`guides.${guide.key}.title`),
      role: t(`roles.${role}.name`),
    }),
    description: t(`guides.${guide.key}.summary`),
  });
}

/** `/help/<role>/<guide>`: one guide as numbered, illustrated steps. */
export default async function GuidePage({ params }: Props) {
  const { role, guide } = await guideFromParams(params);
  const t = await getTranslations("help");

  const guides = guidesFor(role);
  const at = guides.findIndex((candidate) => candidate.key === guide.key);
  const next = guides[(at + 1) % guides.length] ?? guide;
  const related = ROLE_HELP[role].faqs
    .filter((key) => faq(key).topic === guide.topic)
    .slice(0, 4);
  const TopicIcon = TOPIC_ICONS[guide.topic];

  return (
    <>
      <HelpHero
        breadcrumbs={
          <HelpBreadcrumbs
            items={[
              { label: t("home"), href: "/help" },
              { label: t(`roles.${role}.name`), href: `/help/${role}` },
              { label: t(`guides.${guide.key}.title`) },
            ]}
          />
        }
        title={t(`guides.${guide.key}.title`)}
        lead={t(`guides.${guide.key}.summary`)}
        art={<IconTile icon={guide.icon} size="lg" className="mx-auto" />}
      >
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1 font-medium">
            <TopicIcon aria-hidden className="size-4 text-foreground" />
            {t(`topics.${guide.topic}`)}
          </span>
          <span className="rounded-md bg-muted px-3 py-1 text-muted-foreground">
            {t("role.steps", { count: guide.steps.length })}
          </span>
        </p>
      </HelpHero>

      <Container className="grid items-start gap-4 pb-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          aria-labelledby="guide-steps"
          className="min-w-0 rounded-panel bg-card p-5 shadow-panel sm:p-6"
        >
          <h2 id="guide-steps" className="sr-only">
            {t("guide.stepsHeading")}
          </h2>
          <GuideSteps guide={guide} />
        </section>

        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
          {related.length > 0 ? (
            <HelpSection id="related" title={t("guide.relatedHeading")}>
              <FaqList faqs={related} />
            </HelpSection>
          ) : null}

          <HelpSection id="next" title={t("guide.nextHeading")}>
            <div className="group relative flex gap-4 border-y py-5 transition-colors hover:bg-muted/30 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
              <IconTile icon={next.icon} size="sm" />
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="font-semibold">
                  <Link
                    href={`/help/${role}/${next.slug}`}
                    className="outline-none after:absolute after:inset-0"
                  >
                    {t(`guides.${next.key}.title`)}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(`guides.${next.key}.summary`)}
                </p>
              </div>
              <ArrowRightIcon
                aria-hidden
                className="size-5 shrink-0 self-center text-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              />
            </div>
          </HelpSection>

          <Link
            href={`/help/${role}`}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
            {t(`roles.${role}.title`)}
          </Link>
        </div>
      </Container>

      <Container className="pb-8">
        <ContactStrip role={role} topic={supportTopicFor(guide.topic, role)} />
      </Container>
    </>
  );
}
