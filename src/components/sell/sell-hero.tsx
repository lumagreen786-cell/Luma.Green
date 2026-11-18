import Image from "next/image";
import { getTranslations } from "next-intl/server";

import recycleIllustration from "../../../public/images/showcase/recycle-household-illustration.webp";

/** A compact page label leaves the current collection question in focus. */
export async function SellHero() {
  const t = await getTranslations("sell.simple");
  return (
    <header className="flex flex-col items-start gap-6 py-3">
      <h1 className="font-display text-4xl leading-tight font-normal tracking-tight sm:text-5xl">
        {t("title")}
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t("estimateLater")}
      </p>
      <Image
        src={recycleIllustration}
        alt=""
        className="aspect-[4/3] max-h-64 w-full rounded-2xl object-cover lg:max-h-none"
        sizes="(min-width: 1024px) 40vw, 100vw"
      />
    </header>
  );
}
