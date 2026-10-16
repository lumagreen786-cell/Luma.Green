import { QuoteIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

import { Container } from "../container";
import effects from "../public-effects.module.css";

const voices = ["household", "kabadiwala", "manufacturer"] as const;

/** Founder-requested sample copy, visibly identified before every quote. */
export async function DemoTestimonials() {
  const [t, roles] = await Promise.all([
    getTranslations("home.testimonials"),
    getTranslations("home.roles"),
  ]);

  return (
    <section
      aria-labelledby="demo-testimonials-heading"
      className="border-y py-4"
    >
      <Container>
        <p className="text-sm text-muted-foreground">{t("note")}</p>
        <details className="group">
          <summary className="cursor-pointer py-3 text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {t("title")}
          </summary>
          <div className="space-y-3 py-3">
            <h2
              id="demo-testimonials-heading"
              className="font-display text-2xl font-medium tracking-tight sm:text-3xl"
            >
              {t("title")}
            </h2>
          </div>
          <ul className="divide-y border-y">
            {voices.map((role) => (
              <li key={role} className="py-6">
                <figure className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 gap-y-3">
                  <QuoteIcon aria-hidden className="mt-1 size-5 text-primary" />
                  <blockquote
                    className={cn(
                      "max-w-2xl font-display text-xl leading-relaxed font-medium sm:text-2xl",
                      effects.quote,
                    )}
                  >
                    <p>{t(role)}</p>
                  </blockquote>
                  <figcaption className="col-start-2 text-sm text-muted-foreground">
                    {roles(`${role}.title`)}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </details>
      </Container>
    </section>
  );
}
