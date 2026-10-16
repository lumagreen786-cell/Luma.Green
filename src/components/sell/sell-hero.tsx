import Image from "next/image";
import { getTranslations } from "next-intl/server";

import recycleIllustration from "../../../public/images/showcase/recycle-household-illustration.webp";

/** A compact page label leaves the current collection question in focus. */
export async function SellHero() {
  const t = await getTranslations("sell.simple");
  return (
    <header className="flex items-center justify-between gap-4">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <Image
        src={recycleIllustration}
        alt=""
        className="w-24 rounded-lg sm:w-32"
        sizes="128px"
      />
    </header>
  );
}
