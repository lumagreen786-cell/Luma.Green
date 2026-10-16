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
    <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
      {APPLICATION_KINDS.map((kind) => (
        <li key={kind} className="min-w-0">
          <Link
            href={`/join/${kind}`}
            className="group flex h-full min-w-0 flex-col gap-4 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <RoleStoryImage
              scene={roleProcessScenes[kind]}
              frameClassName="aspect-[4/3] rounded-md"
              sizes="(min-width: 1280px) 380px, (min-width: 640px) 45vw, 92vw"
            />
            <span className="flex min-w-0 items-start justify-between gap-4">
              <span className="min-w-0 font-display text-xl leading-tight font-semibold tracking-tight wrap-anywhere group-hover:text-primary sm:text-2xl">
                {t(`roles.${kind}.title`)}
              </span>
              <ArrowRightIcon
                aria-hidden
                className="mt-1 size-5 shrink-0 text-primary rtl:rotate-180"
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
