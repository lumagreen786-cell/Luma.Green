import {
  BadgeCheckIcon,
  HandCoinsIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { RoleStoryImage } from "@/components/showcase/role-story-image";

const PROMISES = [
  { key: "noAccount", icon: UserRoundCheckIcon },
  { key: "payAtDoor", icon: HandCoinsIcon },
  { key: "verified", icon: BadgeCheckIcon },
] as const;

/** The top of /sell: what this is, in one line, and three reasons to trust it. */
export async function SellHero() {
  const t = await getTranslations("sell");
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-4 border-b border-border pb-5 text-foreground lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-6 lg:border-0">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="max-w-2xl font-display text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            {t("lead")}
          </p>
          <p className="text-xs text-muted-foreground">{t("eyebrow")}</p>
        </div>
      </div>
      <RoleStoryImage
        scene="preparation"
        frameClassName="aspect-square rounded-md lg:aspect-[4/3]"
        className="w-full"
        sizes="(min-width: 1024px) 400px, 88px"
      />
      <ul
        aria-label={t("promises.label")}
        className="col-span-2 flex flex-wrap gap-x-4 gap-y-3 lg:flex-col"
      >
        {PROMISES.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm"
          >
            <Icon aria-hidden className="size-4" />
            {t(`promises.${key}`)}
          </li>
        ))}
      </ul>
    </header>
  );
}
