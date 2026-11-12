import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  roleProcessScenes,
  RoleStoryImage,
} from "@/components/showcase/role-story-image";
import { Link } from "@/i18n/navigation";

import { APPLICATION_KINDS } from "../../../convex/lib/onboarding";

/** An image-led directory: choose a role before completing its requirements. */
export function RoleCards() {
  const t = useTranslations("join");
  return (
    <ul className="grid gap-3">
      {APPLICATION_KINDS.map((kind) => (
        <li key={kind} className="min-w-0">
          <Link
            href={`/join/${kind}`}
            className="group grid h-full min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-center gap-4 rounded-panel bg-card p-4 shadow-panel transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] sm:p-5"
          >
            <RoleStoryImage
              scene={roleProcessScenes[kind]}
              frameClassName="aspect-square rounded-2xl sm:aspect-[3/2]"
              sizes="(min-width: 640px) 144px, 80px"
            />
            <span className="flex min-w-0 items-start justify-between gap-4">
              <span className="min-w-0 font-display text-xl leading-tight font-medium tracking-tight wrap-anywhere group-hover:text-foreground">
                {t(`roles.${kind}.title`)}
              </span>
              <ArrowRightIcon
                aria-hidden
                className="mt-1 size-5 shrink-0 text-foreground rtl:rotate-180"
              />
            </span>
            <span className="col-span-2 text-sm leading-relaxed text-muted-foreground sm:col-span-1">
              {t(`roles.${kind}.body`)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
