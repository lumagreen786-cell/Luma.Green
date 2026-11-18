import { ArrowDown, ArrowUpRight, CalendarDays, Plus } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { BookingPhone } from "@/components/afterlife/booking-phone";
import { Reveal } from "@/components/afterlife/reveal";
import { RotatingAudience } from "@/components/afterlife/rotating-audience";
import { WhatsAppIcon } from "@/components/afterlife/whatsapp-icon";
import { isLocale } from "@/i18n/locales";
import { businessHref } from "@/lib/site-domains";

import { BookNow } from "./book-now";
import styles from "./landing.module.css";
export async function AfterlifeHome() {
  const t = await getTranslations("afterlife");
  const locale = await getLocale();
  return (
    <>
      <section className={styles.hero}>
        <Image
          unoptimized
          src="/images/showcase/household-preparation.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.scrim} />
        <div className={styles.heroCopy}>
          <RotatingAudience />
          <h1>
            {t("heroTitle")}
            <br />
            {t("heroTitleEnd")}
          </h1>
          <p>{t("heroLead")}</p>
          <div className={styles.actions}>
            <BookNow />
            <a href="#how" className={styles.textLink}>
              {t("how")}
              <ArrowDown size={17} />
            </a>
          </div>
        </div>
      </section>
      <section id="how" className={`${styles.section} ${styles.split}`}>
        <Reveal>
          <p className={styles.eyebrow}>{t("phoneEyebrow")}</p>
          <h2>{t("phoneTitle")}</h2>
          <p className="mb-8 text-muted-foreground">{t("phoneLead")}</p>
          <BookNow />
        </Reveal>
        <div className={styles.phone}>
          <BookingPhone />
        </div>
      </section>
      <section className={styles.story}>
        <div className={styles.storyImage}>
          <Image
            unoptimized
            src="/images/showcase/material-sorting.webp"
            alt={t("imageAlt")}
            fill
            sizes="(max-width:800px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <Reveal className={styles.storyCopy}>
          <p className={styles.eyebrow}>{t("storyEyebrow")}</p>
          <h2>{t("storyTitle")}</h2>
          <p className="text-muted-foreground">{t("storyLead")}</p>
          <p className="flex items-center gap-3">
            <CalendarDays size={18} />
            {t("repeat")}
          </p>
          <p className="flex items-center gap-3">
            <WhatsAppIcon className="size-5" />
            {t("updates")}
          </p>
          <BookNow />
        </Reveal>
      </section>
      <section id="questions" className={`${styles.section} ${styles.split}`}>
        <h2>{t("faqTitle")}</h2>
        <div className={styles.faq}>
          {(["1", "2", "3"] as const).map((n) => (
            <details key={n}>
              <summary>
                {t(`faq${n}q`)}
                <Plus size={18} />
              </summary>
              <p>{t(`faq${n}a`)}</p>
            </details>
          ))}
        </div>
      </section>
      <section className={styles.closing}>
        <h2>{t("closingTitle")}</h2>
        <BookNow />
      </section>
      <div className={styles.businessBand}>
        <p>{t("businessPrompt")}</p>
        <a
          className={styles.textLink}
          href={businessHref("/", isLocale(locale) ? locale : "en")}
        >
          {t("workWith")}
          <ArrowUpRight size={18} />
        </a>
      </div>
    </>
  );
}
