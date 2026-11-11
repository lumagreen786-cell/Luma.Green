import { PencilLineIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { contactHref } from "./content";
import type { SupportRole, SupportTopic } from "./support-api";

/**
 * "Still need help?": write to support. `role` and `topic` pre-fill the form.
 */
export function ContactStrip({
  role,
  topic,
}: {
  role?: SupportRole;
  topic?: SupportTopic;
}) {
  const t = useTranslations("help");
  return (
    <section
      data-reveal
      aria-labelledby="contact-strip-heading"
      className="flex min-w-0 flex-col gap-4 rounded-xl bg-accent/40 p-5 text-foreground"
    >
      <div className="flex max-w-md flex-col gap-3">
        <h2
          id="contact-strip-heading"
          className="font-display text-lg font-semibold tracking-tight"
        >
          {t("contactStrip.title")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("contactStrip.body")}
        </p>
        <p className="text-sm text-muted-foreground">{t("hours")}</p>
      </div>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-h-11 max-w-full border-border bg-card px-4 py-2 text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Link href={contactHref(role, topic)}>
              <PencilLineIcon aria-hidden />
              {t("contactStrip.write")}
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("contact.phoneUnavailable")}
        </p>
      </div>
    </section>
  );
}
