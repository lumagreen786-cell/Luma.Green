import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { actionName } from "@/components/site/action-name";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { Container } from "./container";

/** Two clear next actions at the end of the public material story. */
export async function ClosingCta() {
  const [t, nav] = await Promise.all([
    getTranslations("home.closing"),
    getTranslations("nav"),
  ]);
  return (
    <section
      aria-labelledby="closing-cta-heading"
      className="border-t bg-background py-12 sm:py-20 lg:py-24"
    >
      <Container className="grid min-w-0 grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
        <div data-reveal className="max-w-3xl min-w-0 space-y-5 wrap-anywhere">
          <h2
            id="closing-cta-heading"
            className="font-display text-4xl leading-[1.08] font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {t("title")}
          </h2>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-col">
          <Button
            asChild
            size="lg"
            className="min-h-12 max-w-full min-w-0 justify-between py-3 text-start whitespace-nowrap"
          >
            <Link
              href="/sell"
              aria-label={actionName(nav("sellScrap"), t("sell"))}
            >
              <span className="sm:hidden">{nav("sellScrap")}</span>
              <span className="hidden sm:inline">{t("sell")}</span>
              <ArrowRightIcon aria-hidden className="size-5 rtl:rotate-180" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-h-12 max-w-full min-w-0 py-3 text-start whitespace-nowrap"
          >
            <Link href="/join" aria-label={actionName(nav("join"), t("join"))}>
              <span className="sm:hidden">{nav("join")}</span>
              <span className="hidden sm:inline">{t("join")}</span>
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
