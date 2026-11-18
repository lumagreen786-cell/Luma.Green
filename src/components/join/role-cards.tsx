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
    <ul className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      {APPLICATION_KINDS.map((kind) => (
        <li key={kind} className="min-w-0">
          <Link
            href={`/join/${kind}`}
            className="group grid h-full min-w-0 gap-5 border-t border-border py-6 transition-colors outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <RoleStoryImage
              scene={roleProcessScenes[kind]}
              frameClassName="h-52 aspect-auto rounded-2xl"
              sizes="(min-width: 768px) 45vw, 90vw"
            />
            <span className="flex min-w-0 items-start justify-between gap-4">
              <span className="min-w-0 font-display text-2xl leading-tight font-medium tracking-tight wrap-anywhere group-hover:text-foreground">
                {t(`roles.${kind}.title`)}
              </span>
              <ArrowRightIcon
                aria-hidden
                className="mt-1 size-5 shrink-0 text-foreground rtl:rotate-180"
              />
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              {t(`roles.${kind}.body`)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
