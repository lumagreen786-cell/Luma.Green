import { ChevronRightIcon, SunIcon, WrenchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { HouseholdLocationLookups } from "@/components/sell/household-location-lookups";
import { Container } from "@/components/site/container";
import { Link } from "@/i18n/navigation";
import { privateMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("householdTools");
  return privateMetadata(t("services"));
}

export default async function HouseholdServicesPage() {
  const [t, footer, services] = await Promise.all([
    getTranslations("householdTools"),
    getTranslations("footer"),
    getTranslations("serviceRecords"),
  ]);
  const links = [
    { label: footer("solar"), href: "/solar", icon: SunIcon },
    { label: services("title"), href: "/account/services", icon: WrenchIcon },
  ];
  return (
    <Container className="flex max-w-2xl flex-col gap-6 py-8">
      <h1 className="font-display text-2xl font-semibold">{t("services")}</h1>
      <HouseholdLocationLookups />
      <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-5">
        {links.map(({ label, href, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-12 items-center gap-3 py-3 font-medium hover:text-primary"
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRightIcon
                aria-hidden
                className="size-5 shrink-0 rtl:rotate-180"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
