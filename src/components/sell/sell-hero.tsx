import Image from "next/image";
import { getTranslations } from "next-intl/server";

/** A compact page label leaves the current collection question in focus. */
export async function SellHero() {
  const t = await getTranslations("sell.simple");
  return (
    <header className="flex flex-col items-start gap-5 rounded-2xl bg-card p-5 sm:p-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t("estimateLater")}
      </p>
      <Image
        src="/images/ship-x/booking.webp"
        width={1536}
        height={1024}
        alt=""
        className="aspect-[4/3] max-h-48 w-full rounded-xl object-cover lg:max-h-none"
        sizes="(min-width: 1024px) 40vw, 100vw"
      />
    </header>
  );
}
