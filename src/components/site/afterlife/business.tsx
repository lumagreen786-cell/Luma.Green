import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Reveal } from "@/components/afterlife/reveal";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import styles from "./landing.module.css";
const roles = [
  {
    key: "kabadiwala",
    image: "kabadiwala-weighing.webp",
    href: "/business/collectors",
  },
  {
    key: "preprocessor",
    image: "material-sorting.webp",
    href: "/join/preprocessor",
  },
  { key: "recycler", image: "recycling-line.webp", href: "/join/recycler" },
  {
    key: "manufacturer",
    image: "recycled-pellets.webp",
    href: "/join/manufacturer",
  },
  { key: "saathi", image: "collection-partners.webp", href: "/join/saathi" },
] as const;
export async function AfterlifeBusiness({
  collectors = false,
}: {
  collectors?: boolean;
}) {
  const t = await getTranslations("afterlife");
  return (
    <>
      <section className={styles.hero}>
        <Image
          src={`/images/showcase/${collectors ? "kabadiwala-weighing.webp" : "material-yard.webp"}`}
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.scrim} />
        <Reveal className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            {t(collectors ? "collectors" : "businessEyebrow")}
          </p>
          <h1>
            {t(collectors ? "collectorTitle" : "businessTitle")}
            <br />
            {t(collectors ? "collectorTitleEnd" : "businessTitleEnd")}
          </h1>
          <p>{t(collectors ? "collectorLead" : "businessLead")}</p>
          <div className={styles.actions}>
            <Button asChild size="lg">
              <Link href={collectors ? "/join/kabadiwala" : "#roles"}>
                {t(collectors ? "roleAction" : "findRole")}
                <ArrowUpRight />
              </Link>
            </Button>
            <Link href="/login" className={styles.textLink}>
              {t("signIn")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </Reveal>
      </section>
      {collectors ? (
        <section className={styles.section}>
          <Reveal>
            <h2>{t("collectorFlow")}</h2>
          </Reveal>
          <div className={styles.roles}>
            {(["1", "2", "3"] as const).map((n) => (
              <Reveal key={n} className={styles.role}>
                <span className={styles.eyebrow}>0{n}</span>
                <h3>{t(`step${n}`)}</h3>
                <p className="text-muted-foreground">{t(`step${n}Body`)}</p>
              </Reveal>
            ))}
          </div>
        </section>
      ) : (
        <section id="roles" className={styles.section}>
          <Reveal>
            <h2>{t("rolesTitle")}</h2>
            <p className="text-muted-foreground">{t("rolesLead")}</p>
          </Reveal>
          <div className={styles.roles}>
            {roles.map((role) => (
              <Reveal key={role.key} className={styles.role}>
                <div className={styles.roleImage}>
                  <Image
                    src={`/images/showcase/${role.image}`}
                    alt={t("imageAlt")}
                    fill
                    sizes="(max-width:800px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <h3>{t(role.key)}</h3>
                <p className="text-muted-foreground">{t(`${role.key}Body`)}</p>
                <Link href={role.href} className={styles.textLink}>
                  {t("roleAction")}
                  <ArrowUpRight size={17} />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}
      <section className={styles.closing}>
        <h2>{t("businessClosing")}</h2>
        <Button asChild size="lg">
          <Link href={collectors ? "/join/kabadiwala" : "/join/roles"}>
            {t("roleAction")}
            <ArrowUpRight />
          </Link>
        </Button>
      </section>
    </>
  );
}
