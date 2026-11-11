import { MailIcon, ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/site/container";
import { PageHeader } from "@/components/site/page-header";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "contact" });

  return pageMetadata({
    locale,
    path: "/contact",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const emailLink =
  "inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 rounded-sm";

/**
 * Email only for now: a form needs Resend wired (AGENTS.md §9), and a form that
 * silently drops messages is worse than an address.
 */
export default async function ContactPage() {
  const t = await getTranslations("contact");
  const imageRole = "admin";

  return (
    <>
      <PageHeader
        variant="task"
        title={t("title")}
        lead={t("lead")}
        scene={imageRole}
      />

      <Container className="grid items-start gap-4 pb-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="grid gap-4 rounded-xl bg-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <MailIcon aria-hidden className="size-6 text-primary" />

            <h2 className="text-lg font-semibold">{t("emailHeading")}</h2>
          </div>
          <div className="rounded-xl bg-accent/40 px-4 py-2">
            <a href={`mailto:${site.supportEmail}`} className={emailLink}>
              {site.supportEmail}
            </a>
          </div>
        </section>
        <section className="grid gap-4 rounded-xl bg-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <ShieldAlertIcon aria-hidden className="size-6 text-primary" />

            <h2 className="text-lg font-semibold">{t("securityHeading")}</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("securityBody")}</p>
            <a href={`mailto:${site.securityEmail}`} className={emailLink}>
              {site.securityEmail}
            </a>
          </div>
        </section>
      </Container>
    </>
  );
}
