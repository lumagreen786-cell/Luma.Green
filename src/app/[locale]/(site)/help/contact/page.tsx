import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import {
  ContactForm,
  ContactFormSkeleton,
} from "@/components/help/contact-form";
import { ContactPanel } from "@/components/help/contact-panel";
import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { HelpHero } from "@/components/help/help-hero";
import { Container } from "@/components/site/container";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "help" });

  return pageMetadata({
    locale,
    path: "/help/contact",
    title: t("contact.metaTitle"),
    description: t("contact.metaDescription"),
  });
}

/** `/help/contact`: send the team a message and check support availability. */
export default async function HelpContactPage() {
  const t = await getTranslations("help");

  return (
    <>
      <HelpHero
        banner="admin"
        breadcrumbs={
          <HelpBreadcrumbs
            items={[
              { label: t("home"), href: "/help" },
              { label: t("contact.title") },
            ]}
          />
        }
        title={t("contact.title")}
        lead={t("contact.lead")}
      />

      <Container className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-8">
        <section
          aria-labelledby="contact-form-heading"
          className="flex flex-col gap-5"
        >
          <h2
            id="contact-form-heading"
            className="font-display text-2xl font-semibold tracking-tight"
          >
            {t("contact.formHeading")}
          </h2>
          {/* The form reads ?role= and ?topic= from the address. */}
          <Suspense fallback={<ContactFormSkeleton />}>
            <ContactForm />
          </Suspense>
        </section>
        <ContactPanel />
      </Container>
    </>
  );
}
