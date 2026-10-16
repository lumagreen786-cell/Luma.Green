import { HomeIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RoleCards } from "@/components/join/role-cards";
import { Container } from "@/components/site/container";
import { Link } from "@/i18n/navigation";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "join" });
  return pageMetadata({
    locale,
    path: "/join",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Public: what each role is and a way in — docs/architecture/urls.md. */
export default async function JoinPage() {
  const [t, stakeholder, nav] = await Promise.all([
    getTranslations("join"),
    getTranslations("stakeholder"),
    getTranslations("nav"),
  ]);

  return (
    <Container className="flex max-w-7xl flex-col gap-8 py-8 sm:gap-12 sm:py-12">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
      </header>
      <RoleCards />
      <aside className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/sell"
          className="inline-flex min-h-11 items-center gap-3 font-medium text-primary underline-offset-4 hover:underline"
        >
          <HomeIcon aria-hidden className="size-5 shrink-0" />
          {nav("sellScrap")}
        </Link>
        <Link
          href="/join/stakeholder"
          className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          {stakeholder("title")}
        </Link>
      </aside>
    </Container>
  );
}
