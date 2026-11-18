import { getTranslations } from "next-intl/server";

import { LogoMark } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";

import styles from "./site-chrome.module.css";
export async function SiteFooter() {
  const t = await getTranslations("afterlife");
  return (
    <footer className={styles.footer}>
      <Link href="/" className={styles.footerBrand}>
        <LogoMark idPrefix="afterlife-footer" className="size-9" />
        <div>
          <span className={styles.footerName}>{site.name}</span>
          <p className={styles.tagline}>{t("tagline")}</p>
        </div>
      </Link>
      <nav aria-label={t("menu")}>
        <Link href="/help">{t("help")}</Link>
        <Link href="/privacy">{t("privacy")}</Link>
        <Link href="/status">{t("status")}</Link>
      </nav>
    </footer>
  );
}
