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
      />

      <Container className="grid items-start gap-5 pb-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section
          aria-label={t("search.label")}
          className="min-w-0 rounded-panel bg-card p-5 shadow-panel sm:p-7"
        >
          <HelpSearch />
        </section>
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
          <p className="text-sm text-muted-foreground">{t("rolesLead")}</p>
          <RoleCards />
        </section>

        <div className="lg:col-span-2">
          <ContactStrip />
        </div>
      </Container>
    </>
  );
}
