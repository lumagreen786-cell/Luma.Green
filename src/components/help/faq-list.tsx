import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { faqAnchor, type FaqKey } from "./content";
import { FaqHashOpener } from "./faq-hash-opener";

/**
 * Questions as a disclosure list: native `<details>`, so each one opens with a
 * tap, Enter or Space, works without JavaScript, and find-in-page reaches the
 * answers.
 */
export function FaqList({ faqs }: { faqs: readonly FaqKey[] }) {
  const t = useTranslations("help");
  return (
    <div className="divide-y border-y">
      {faqs.map((key) => (
        <details key={key} id={faqAnchor(key)} className="group scroll-mt-20">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-start font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span>{t(`faqs.${key}.q`)}</span>
            <ChevronDownIcon
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="max-w-prose pe-8 pb-5 text-pretty text-muted-foreground">
            {t(`faqs.${key}.a`)}
          </p>
        </details>
      ))}
      <FaqHashOpener />
    </div>
  );
}
