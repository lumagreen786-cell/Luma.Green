import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ContactStrip } from "@/components/help/contact-strip";
import {
  HELP_ROLES,
  type HelpRole,
  isHelpRole,
  ROLE_HELP,
} from "@/components/help/content";
import { FaqList } from "@/components/help/faq-list";
import { GuideCards } from "@/components/help/guide-cards";
import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { HelpHero } from "@/components/help/help-hero";
import { HelpSection, JumpLinks } from "@/components/help/help-section";
import { OtherRoleLinks } from "@/components/help/role-cards";
import { TrainingPath } from "@/components/help/training-path";
import { TutorialCards } from "@/components/help/tutorial-cards";
import { Container } from "@/components/site/container";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; role: string }>;
}

/** One page per role, in every locale. */
export function generateStaticParams() {
  return HELP_ROLES.map((role) => ({ role }));
}

async function roleFromParams(params: Props["params"]): Promise<HelpRole> {
  const { role } = await params;
  if (!isHelpRole(role)) notFound();
  return role;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [locale, role] = await Promise.all([
    localeFromParams(params),
    roleFromParams(params),
  ]);
  const t = await getTranslations({ locale, namespace: "help" });

  return pageMetadata({
    locale,
    path: `/help/${role}`,
    title: t(`roles.${role}.title`),
    description: t(`roles.${role}.lead`),
  });
}

/** `/help/<role>`: guides, questions, videos and training for one role. */
export default async function RoleHelpPage({ params }: Props) {
  const role = await roleFromParams(params);
  const t = await getTranslations("help");
  const help = ROLE_HELP[role];

  const sections = [
    { id: "guides", label: t("role.guidesHeading") },
    { id: "questions", label: t("role.faqsHeading") },
    { id: "videos", label: t("role.tutorialsHeading") },
    { id: "training", label: t("role.trainingHeading") },
  ] as const;

  return (
    <>
      <HelpHero
        breadcrumbs={
          <HelpBreadcrumbs
            items={[
              { label: t("home"), href: "/help" },
              { label: t(`roles.${role}.name`) },
            ]}
          />
        }
        title={t(`roles.${role}.title`)}
        lead={t(`roles.${role}.lead`)}
        banner={role}
      >
        <JumpLinks label={t("role.onThisPage")} links={sections} />
      </HelpHero>

      <Container className="grid items-start gap-4 pb-8 lg:grid-cols-2">
        <HelpSection
          className="lg:col-span-2"
          id="guides"
          title={t("role.guidesHeading")}
          lead={t("role.guidesLead")}
        >
          <GuideCards role={role} />
        </HelpSection>

        <HelpSection
          id="questions"
          title={t("role.faqsHeading")}
          lead={t("role.faqsLead")}
        >
          <FaqList faqs={help.faqs} />
        </HelpSection>

        <HelpSection
          id="videos"
          title={t("role.tutorialsHeading")}
          lead={t("role.tutorialsLead")}
        >
          <TutorialCards role={role} />
        </HelpSection>

        <HelpSection
          id="training"
          title={t("role.trainingHeading")}
          lead={t("role.trainingLead")}
        >
          <TrainingPath role={role} />
        </HelpSection>

        <ContactStrip role={role} />

        <HelpSection id="other-roles" title={t("role.otherRoles")}>
          <OtherRoleLinks current={role} />
        </HelpSection>
      </Container>
    </>
  );
}
