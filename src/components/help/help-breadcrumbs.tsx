import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

type Href = ComponentProps<typeof Link>["href"];

export interface Crumb {
  label: string;
  /** Leave out for the current page. */
  href?: Href;
}

/** Where this page sits in the help centre. The last crumb is this page. */
export function HelpBreadcrumbs({ items }: { items: readonly Crumb[] }) {
  const t = useTranslations("help");
  return (
    <nav aria-label={t("breadcrumb")}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRightIcon aria-hidden className="size-4 rtl:rotate-180" />
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center rounded-sm px-0.5 font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="px-0.5 text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
