"use client";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { NativeUpdateControl } from "@/components/app/native-update-control";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { isLocale } from "@/i18n/locales";
import { Link, usePathname } from "@/i18n/navigation";
import { businessHref } from "@/lib/site-domains";

import { LanguageSwitcher } from "./language-switcher";
import styles from "./site-chrome.module.css";
function subscribeHost(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
  };
}
const isBusinessHostSnapshot = () =>
  window.location.hostname === "business.luma.green";
const isServerBusinessHost = () => false;

export function SiteHeader() {
  const t = useTranslations("afterlife");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigationId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      menuButton.current?.focus();
    };
    const desktop = window.matchMedia("(min-width: 1001px)");
    const onResize = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);
  const isBusinessHost = useSyncExternalStore(
    subscribeHost,
    isBusinessHostSnapshot,
    isServerBusinessHost,
  );
  const isBusiness = pathname.startsWith("/business") || isBusinessHost;
  const isHero = ["/", "/business", "/business/collectors"].includes(pathname);
  const lang = isLocale(locale) ? locale : "en";
  return (
    <header className={`${styles.header} ${isHero ? styles.overImage : ""}`}>
      <Link
        href={isBusiness ? "/business" : "/"}
        aria-label="Luma.Green"
        className={styles.logo}
      >
        <Logo className="gap-2 [&>span]:text-2xl [&>svg]:size-9" />
      </Link>
      <nav
        id={navigationId}
        className={`${styles.nav} ${open ? styles.open : ""}`}
        aria-label={t("menu")}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a"))
            setOpen(false);
        }}
      >
        {isBusiness ? (
          <>
            <Link href="/business#roles">{t("ecosystem")}</Link>
            <Link href="/business/collectors">{t("collectors")}</Link>
            <Link href="/login">
              {t("signIn")}
              <ArrowUpRight size={15} />
            </Link>
          </>
        ) : (
          <>
            <Link href="/#how">{t("how")}</Link>
            <Link href="/#questions">{t("questions")}</Link>
            <a href={businessHref("/", lang)}>
              {t("business")}
              <ArrowUpRight size={15} />
            </a>
          </>
        )}
        <div className={styles.mobileLanguage}>
          <LanguageSwitcher />
        </div>
      </nav>
      <div className={styles.tools}>
        <div className={styles.desktopLanguage}>
          <LanguageSwitcher />
        </div>
        <ThemeToggle />
        <NativeUpdateControl compact />
        <button
          type="button"
          className={styles.menu}
          ref={menuButton}
          aria-controls={navigationId}
          aria-label={t("menu")}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
