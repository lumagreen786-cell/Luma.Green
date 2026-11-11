import { ArrowRightIcon, HouseIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import {
  roleProcessScenes,
  RoleStoryImage,
} from "@/components/showcase/role-story-image";
import { ClosingCta } from "@/components/site/closing-cta";
import { Container } from "@/components/site/container";
import { roles } from "@/components/site/content";
import { PageHeader } from "@/components/site/page-header";
import { Link } from "@/i18n/navigation";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "participants" });

  return pageMetadata({
    locale,
    path: "/participants",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function ParticipantsPage() {
  const [t, showcase, roleCopy, help] = await Promise.all([
    getTranslations("participants"),
    getTranslations("showcase"),
    getTranslations("home.roles"),
    getTranslations("help"),
  ]);
  const participants = [
    {
      key: "household",
      icon: HouseIcon,
      title: t("householdHeading"),
      body: t("householdBody"),
      href: "/sell",
      action: roleCopy("household.cta"),
    },
    ...roles.map(({ key, icon }) => ({
      key,
      icon,
      title: t(`${key}.name`),
      body: t(`${key}.body`),
      href: `/join/${key}`,
      action: roleCopy(`${key}.cta`),
    })),
    {
      key: "admin",
      icon: ShieldCheckIcon,
      title: showcase("preview.roles.admin.title"),
      body: showcase("adminBody"),
      href: "/help/contact",
      action: help("contact.title"),
    },
  ] as const;

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} scene="pellets" />

      <Container className="pb-8">
        <ul className="grid gap-3 md:grid-cols-2">
          {participants.map(
            ({ key, icon: Icon, title, body, href, action }) => (
              <li key={key}>
                <section
                  aria-labelledby={`participant-${key}`}
                  className="grid h-full min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-4 rounded-xl bg-card p-5"
                >
                  <div className="order-2 min-w-0 space-y-2 wrap-anywhere">
                    <div className="flex items-center gap-4">
                      <span className="hidden size-8 shrink-0 items-center text-primary sm:inline-flex">
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <h2
                        id={`participant-${key}`}
                        className="min-w-0 text-base font-semibold tracking-tight"
                      >
                        {title}
                      </h2>
                    </div>
                    <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                    <Link
                      href={href}
                      className="inline-flex min-h-11 max-w-full items-center gap-3 text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="min-w-0">{action}</span>
                      <ArrowRightIcon
                        aria-hidden
                        className="size-4 shrink-0 rtl:rotate-180"
                      />
                    </Link>
                  </div>
                  <RoleStoryImage
                    scene={roleProcessScenes[key]}
                    placement={`participants-${key}`}
                    sizes="80px"
                    frameClassName="aspect-square rounded-lg"
                    className="order-1 w-full min-w-0"
                  />
                </section>
              </li>
            ),
          )}
        </ul>
      </Container>

      <ClosingCta />
    </>
  );
}
