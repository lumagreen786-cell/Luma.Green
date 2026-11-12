import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { RoleStoryImage } from "@/components/showcase/role-story-image";
import { Link } from "@/i18n/navigation";

const stories = [
  { key: "getReady", scene: "sorting", href: "/help/household/get-ready" },
  {
    key: "weighingAtDoor",
    scene: "fairWeighing",
    href: "/help/household/weighing-at-door",
  },
  {
    key: "verifyBusiness",
    scene: "dispatch",
    href: "/help/yard/verify-business",
  },
] as const;

/** Three useful starting points; every image leads to an existing full guide. */
export function TopicStories() {
  const t = useTranslations("help");
  return (
    <section aria-labelledby="help-topic-stories" className="space-y-5">
      <h2
        id="help-topic-stories"
        className="font-display text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {t("topicsHeading")}
      </h2>
      <ul className="grid gap-7 border-t pt-6 md:grid-cols-3 md:gap-6">
        {stories.map(({ key, scene, href }) => (
          <li key={key} className="min-w-0">
            <Link
              href={href}
              className="group flex h-full flex-col gap-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <RoleStoryImage
                scene={scene}
                frameClassName="aspect-[3/2]"
                sizes="(min-width: 1280px) 380px, (min-width: 768px) 30vw, 92vw"
              />
              <h3 className="flex items-start justify-between gap-3 text-xl font-semibold tracking-tight group-hover:text-foreground">
                <span>{t(`guides.${key}.title`)}</span>
                <ArrowRightIcon
                  aria-hidden
                  className="mt-1 size-5 shrink-0 text-foreground rtl:rotate-180"
                />
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`guides.${key}.summary`)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
