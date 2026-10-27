import {
  ArrowRightIcon,
  FactoryIcon,
  HandHelpingIcon,
  HouseIcon,
  type LucideIcon,
  RecycleIcon,
  StoreIcon,
  WarehouseIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { RoleStoryImage } from "@/components/showcase/role-story-image";
import { Link } from "@/i18n/navigation";

import { Container } from "../container";
import { SectionHeading } from "../section-heading";

const roles = [
  { key: "household", icon: HouseIcon, href: "/sell" },
  { key: "kabadiwala", icon: StoreIcon, href: "/join/kabadiwala" },
  { key: "yard", icon: WarehouseIcon, href: "/join/yard" },
  { key: "recycler", icon: RecycleIcon, href: "/join/recycler" },
  { key: "manufacturer", icon: FactoryIcon, href: "/join/manufacturer" },
  { key: "saathi", icon: HandHelpingIcon, href: "/join/saathi" },
] as const satisfies readonly { key: string; icon: LucideIcon; href: string }[];

/** A compact directory puts every role on equal footing. */
export async function RoleBenefits({
  businessOnly = false,
}: { businessOnly?: boolean } = {}) {
  const [t, hero] = await Promise.all([
    getTranslations("home.roles"),
    getTranslations("home.hero"),
  ]);
  return (
    <section
      aria-labelledby="roles-heading"
      className="bg-background py-10 sm:py-12 lg:py-16"
    >
      <Container className="space-y-8">
        <SectionHeading
          id="roles-heading"
          title={businessOnly ? hero("join") : t("heading")}
          intro={businessOnly ? undefined : t("intro")}
        />
        <ul className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {roles
            .filter((role) => !businessOnly || role.key !== "household")
            .map(({ key, icon: Icon, href }) => (
              <li key={key} data-reveal className="min-w-0">
                <Link
                  href={href}
                  aria-label={t(`${key}.cta`)}
                  className="group grid h-full min-w-0 content-start gap-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <RoleStoryImage
                    scene={key}
                    frameClassName="aspect-[4/3]"
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  />
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon
                      aria-hidden
                      className="size-5 shrink-0 text-primary"
                    />
                    <h3 className="font-display text-2xl font-semibold tracking-tight">
                      {t(`${key}.title`)}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(`${key}.one`)}
                  </p>
                  <span className="inline-flex min-h-11 max-w-full min-w-0 items-center justify-between gap-4 py-2 text-sm font-semibold wrap-anywhere underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="min-w-0">{t(`${key}.cta`)}</span>
                    <ArrowRightIcon
                      aria-hidden
                      className="size-5 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none rtl:rotate-180 rtl:group-hover:-translate-x-1"
                    />
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </Container>
    </section>
  );
}
