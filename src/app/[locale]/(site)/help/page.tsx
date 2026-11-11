import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ContactStrip } from "@/components/help/contact-strip";
import { HelpHero } from "@/components/help/help-hero";
import { HelpSearch } from "@/components/help/help-search";
import { RoleCards } from "@/components/help/role-cards";
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
    path: "/help",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** `/help`: search everything, browse by topic, or pick your role. */
export default async function HelpPage() {
  const t = await getTranslations("help");

  return (
    <>
      <HelpHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        banner="preparation"
      >
        <HelpSearch />
      </HelpHero>

      <Container className="grid items-start gap-4 pb-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section
          aria-labelledby="help-roles"
          className="flex min-w-0 flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="help-roles"
              className="font-display text-lg font-semibold tracking-tight"
            >
              {t("rolesHeading")}
            </h2>
          </div>
          <RoleCards />
        </section>

        <ContactStrip />
      </Container>
    </>
  );
}
