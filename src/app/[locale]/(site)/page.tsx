import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { HomeHero } from "@/components/site/home/hero";
import { HomeResourceGrid } from "@/components/site/home/resource-grid";
import { RoleBenefits } from "@/components/site/home/role-benefits";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata, serializeJsonLd } from "@/lib/seo";
import { site } from "@/lib/site";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const [meta, home] = await Promise.all([
    getTranslations({ locale, namespace: "meta" }),
    getTranslations({ locale, namespace: "home" }),
  ]);

  return pageMetadata({
    locale,
    path: "/",
    title: meta("title"),
    description: home("metaDescription"),
    absoluteTitle: true,
  });
}

/**
 * A direct public path: book recycling, understand the process
 * and find the right role. Detailed stories stay on their dedicated pages.
 */
export default async function HomePage() {
  const t = await getTranslations("home");

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: `${site.url}/logo.svg`,
    slogan: site.tagline,
    description: t("metaDescription"),
    email: site.supportEmail,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD must be raw; serializeJsonLd escapes `<`.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organization) }}
      />
      <div>
        <HomeHero />
        <RoleBenefits businessOnly />
        <HomeResourceGrid />
      </div>
    </>
  );
}
