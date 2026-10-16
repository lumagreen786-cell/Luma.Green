"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isLocale, localeDirection } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";

import { HeaderAuthAction } from "./header-auth-action";
import { LanguageSwitcher } from "./language-switcher";
import { SiteNav } from "./site-nav";

function unsubscribeFromHydration() {
  // The server/client snapshots are static; no external updates are needed.
}
const subscribeToHydration = () => unsubscribeFromHydration;

export function MobileNav({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const theme = useTranslations("theme");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  useEffect(() => {
    // Match the header's xl breakpoint. Do not leave a modal and scroll lock
    // active after the desktop navigation replaces the menu trigger.
    const desktop = window.matchMedia("(min-width: 1280px)");
    const onResize = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener("change", onResize);
    return () => {
      desktop.removeEventListener("change", onResize);
    };
  }, []);

  // The sheet only knows physical sides; open it from the inline end.
  const side =
    isLocale(locale) && localeDirection(locale) === "rtl" ? "left" : "right";
  const close = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className={className}
          aria-label={t("openMenu")}
          disabled={!isHydrated}
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={side}
        className="gap-0 overflow-y-auto pb-[env(safe-area-inset-bottom)] data-[side=left]:w-full data-[side=right]:w-full"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <SheetHeader className="min-h-16 shrink-0 flex-row items-center justify-between px-5 py-2">
          <SheetTitle className="sr-only">{t("label")}</SheetTitle>
          <Logo
            idPrefix="mobile-menu"
            className="gap-2 [&>span]:text-lg [&>svg]:size-7"
          />
          <SheetClose asChild>
            <Button variant="ghost" size="icon-lg" aria-label={t("closeMenu")}>
              <XIcon />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="mx-5 grid shrink-0 gap-2 py-4">
          <HeaderAuthAction
            variant="outline"
            onNavigate={close}
            className="h-auto min-h-12 w-full py-3 text-base whitespace-normal"
          />
          <Button
            asChild
            size="lg"
            className="h-auto min-h-12 w-full py-3 text-base whitespace-normal"
          >
            <Link href="/sell" onClick={close}>
              {t("sellScrap")}
            </Link>
          </Button>
        </div>
        <SiteNav
          className="flex shrink-0 flex-col gap-0 px-5 py-1 [&>a]:min-h-12 [&>a]:rounded-none [&>a]:px-0 [&>a]:py-3 [&>a]:text-base [&>a]:whitespace-nowrap"
          onNavigate={close}
        />
        <div className="mx-5 grid shrink-0 py-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {common("language")}
            </span>
            <LanguageSwitcher />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {theme("label")}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
