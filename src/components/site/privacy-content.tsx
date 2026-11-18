import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";

import { Container } from "./container";
import styles from "./public-pages.module.css";

const sections = [
  "data",
  "sharing",
  "choices",
  "requests",
  "retention",
] as const;
const linkClass =
  "inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

export function PrivacyContent() {
  const t = useTranslations("privacy");
  const removal = useTranslations("accountRemoval");
  const requests = useTranslations("privacyRequests");
  return (
    <Container className="grid gap-10 py-10 sm:py-16 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-x-16">
      <header className="space-y-5 pb-6 lg:col-span-2">
        <h1 className="font-display text-4xl font-normal tracking-tight sm:text-6xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </header>
      <nav
        aria-label={t("title")}
        className="flex flex-col self-start border-s border-border ps-3 lg:sticky lg:top-24"
      >
        {sections.map((section) => (
          <a
            key={section}
            href={`#${section}`}
            className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t(`${section}Title`)}
          </a>
        ))}
      </nav>
      <div className="grid">
        {sections.map((section) => (
          <section
            key={section}
            id={section}
            aria-labelledby={`privacy-${section}`}
            className={`${styles.readingSection} space-y-4`}
          >
            <h2 id={`privacy-${section}`} className="text-lg font-semibold">
              {t(`${section}Title`)}
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              {t(`${section}Body`)}
            </p>
            {section === "requests" && (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Link href="/account/privacy" className={linkClass}>
                  {requests("title")}
                </Link>
                <Link href="/account/removal" className={linkClass}>
                  {removal("title")}
                </Link>
                <a href={`mailto:${site.supportEmail}`} className={linkClass}>
                  {site.supportEmail}
                </a>
              </div>
            )}
          </section>
        ))}
      </div>
    </Container>
  );
}
