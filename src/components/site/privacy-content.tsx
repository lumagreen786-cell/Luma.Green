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
  "inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

export function PrivacyContent() {
  const t = useTranslations("privacy");
  const removal = useTranslations("accountRemoval");
  return (
    <Container className="max-w-3xl space-y-8 py-8 sm:py-12">
      <header className="space-y-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </header>
      {sections.map((section) => (
        <section
          key={section}
          id={section}
          aria-labelledby={`privacy-${section}`}
          className="scroll-mt-24 space-y-3 border-t pt-6"
        >
          <h2 id={`privacy-${section}`} className="text-2xl font-semibold">
            {t(`${section}Title`)}
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            {t(`${section}Body`)}
          </p>
          {section === "requests" && (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
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
    </Container>
  );
}
