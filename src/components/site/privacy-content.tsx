import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";

import { Container } from "./container";

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
    <Container className="grid gap-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <header className="space-y-2 lg:col-span-2">
        <h1 className="font-display text-3xl font-normal tracking-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </header>
      <nav
        aria-label={t("title")}
        className="flex flex-col self-start rounded-panel bg-card p-3 shadow-panel lg:sticky lg:top-24"
      >
        {sections.map((section) => (
          <a
            key={section}
            href={`#${section}`}
            className="flex min-h-11 items-center rounded-full px-3 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t(`${section}Title`)}
          </a>
        ))}
      </nav>
      <div className="grid gap-3">
        {sections.map((section) => (
          <section
            key={section}
            id={section}
            aria-labelledby={`privacy-${section}`}
            className="scroll-mt-24 space-y-3 rounded-panel bg-card p-5 shadow-panel sm:p-6"
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
