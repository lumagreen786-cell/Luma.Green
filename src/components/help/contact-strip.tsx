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
      className="flex flex-col gap-6 border-y py-8 text-foreground lg:flex-row lg:items-center lg:justify-between lg:gap-10"
    >
      <div className="flex max-w-md flex-col gap-3">
        <h2
          id="contact-strip-heading"
          className="font-display text-3xl font-semibold tracking-tight"
        >
          {t("contactStrip.title")}
        </h2>
        <p className="leading-relaxed text-muted-foreground">
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
            className="min-h-12 rounded-lg border-border bg-transparent px-5 py-3 whitespace-nowrap text-foreground hover:bg-accent hover:text-accent-foreground"
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
