import { getTranslations } from "next-intl/server";

import { Container } from "../container";
import { SectionHeading } from "../section-heading";
import { RoleExplorer } from "./role-explorer";

const roles = [
  { key: "household", href: "/sell" },
  { key: "kabadiwala", href: "/join/kabadiwala" },
  { key: "yard", href: "/join/yard" },
  { key: "recycler", href: "/join/recycler" },
  { key: "manufacturer", href: "/join/manufacturer" },
  { key: "saathi", href: "/join/saathi" },
] as const;

/** A compact directory puts every role on equal footing. */
export async function RoleBenefits({
  businessOnly = false,
}: { businessOnly?: boolean } = {}) {
  const [t, hero, join] = await Promise.all([
    getTranslations("home.roles"),
    getTranslations("home.hero"),
    getTranslations("join"),
  ]);
  return (
    <section
      aria-labelledby="roles-heading"
      className="bg-background py-6 sm:py-8"
    >
      <Container className="grid gap-4">
        <SectionHeading
          id="roles-heading"
          title={businessOnly ? hero("join") : t("heading")}
          intro={businessOnly ? undefined : t("intro")}
        />
        <RoleExplorer
          label={t("heading")}
          roles={roles
            .filter((role) => !businessOnly || role.key !== "household")
            .map(({ key, href }) => ({
              key,
              href,
              title: t(`${key}.title`),
              description: t(`${key}.one`),
              action: t(`${key}.cta`),
              actionLabel: key === "household" ? hero("sell") : join("start"),
            }))}
        />
      </Container>
    </section>
  );
}
