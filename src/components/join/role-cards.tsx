import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  roleProcessScenes,
  RoleStoryImage,
} from "@/components/showcase/role-story-image";
import { Link } from "@/i18n/navigation";

import { APPLICATION_KINDS } from "../../../convex/lib/onboarding";

/** Every role someone can join as, each with what it needs and a way in. */
export function RoleCards() {
  const t = useTranslations("join");
  return (
    <ul className="grid gap-x-8 border-t border-border lg:grid-cols-2">
      {APPLICATION_KINDS.map((kind) => {
        return (
          <li key={kind} className="border-b border-border">
            <Link
              href={`/join/${kind}`}
              className="group grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 py-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-5"
            >
              <RoleStoryImage
                scene={roleProcessScenes[kind]}
                compact
                frameClassName="aspect-square rounded-md"
              />
              <span className="contents sm:flex sm:min-w-0 sm:flex-col sm:gap-2">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 font-display text-xl font-semibold tracking-tight wrap-anywhere transition-colors group-hover:text-primary motion-reduce:transition-none">
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
                </span>
                <span className="col-span-2 text-sm leading-relaxed">
                  <span className="font-medium">{t("youNeed")}: </span>
                  {t(`roles.${kind}.needs`)}
                </span>
                <span className="col-span-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 group-hover:underline">
                  {t("start")}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
