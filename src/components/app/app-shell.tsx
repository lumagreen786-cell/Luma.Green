"use client";

import {
  BoxesIcon,
  EllipsisIcon,
  FactoryIcon,
  FileTextIcon,
  LifeBuoyIcon,
  LogOutIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { AccountLinks } from "@/components/account/account-links";
import { useSignOut } from "@/components/account/use-sign-out";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { isCurrentSection } from "@/components/site/site-nav";
import { SkipLink } from "@/components/site/skip-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { WorkspacePermissions } from "@/components/workspace/permissions";
import { isLocale, localeDirection } from "@/i18n/locales";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { NativeUpdateControl } from "./native-update-control";
import { type AppRole, NAV, type NavItem } from "./nav";
import { ListSkeleton } from "./page-parts";
import { useMobileNavCapacity } from "./use-mobile-nav-capacity";
import { useWorkspace } from "./use-workspace";

function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : isCurrentSection(pathname, href);
}

/**
 * The business app's frame: who you are, where you can go, a way out. Phones
 * get a bottom bar; wider screens a sidebar. People without an approved
 * business or Saathi profile are sent to their application.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app");
  const lots = useTranslations("lots");
  const evidence = useTranslations("evidence");
  const facility = useTranslations("facility");
  const sourcing = useTranslations("sourcing");
  const logistics = useTranslations("logistics");
  const qualityDocuments = useTranslations("qualityDocuments");
  const operations = useTranslations("operations");
  const services = useTranslations("serviceRecords");
  const returnClaims = useTranslations("returnClaims");
  const common = useTranslations("common");
  const theme = useTranslations("theme");
  const navigation = useTranslations("nav");
  const locale = useLocale();
  const mobileNavRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const menuOpener = useRef<HTMLButtonElement | null>(null);
  const workspace = useWorkspace();
  const mobileCapacity = useMobileNavCapacity(
    mobileNavRef,
    locale,
    workspace?.kind === "org" || workspace?.kind === "saathi",
  );
  const router = useRouter();
  const pathname = usePathname();
  const { signOut, busy: signingOut } = useSignOut(() => {
    router.replace("/login");
  });

  useEffect(() => {
    if (workspace === null) {
      router.replace({ pathname: "/login", query: { next: pathname } });
    } else if (workspace?.kind === "selectionRequired") {
      router.replace("/account/workspaces");
    } else if (workspace?.kind === "none") {
      router.replace("/join/status");
    }
  }, [workspace, router, pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const onResize = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", onResize);
    return () => {
      desktop.removeEventListener("change", onResize);
    };
  }, []);

  if (
    !workspace ||
    workspace.kind === "none" ||
    workspace.kind === "selectionRequired"
  ) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4">
        <ListSkeleton />
      </div>
    );
  }

  const role: AppRole =
    workspace.kind === "org" ? workspace.org.kind : "saathi";
  const name =
    workspace.kind === "org" ? workspace.org.name : workspace.saathi.name;
  const { primary, more: roleMore } = NAV[role];
  const more: NavItem[] =
    workspace.kind === "org"
      ? [
          ...roleMore,
          {
            href: "/app/services",
            label: "title",
            namespace: "serviceRecords",
            icon: FileTextIcon,
          },
          {
            href: "/app/returns",
            label: "title",
            namespace: "returnClaims",
            icon: BoxesIcon,
          },
          {
            href: "/app/sourcing",
            label: "title",
            namespace: "sourcing",
            icon: FileTextIcon,
          },
          {
            href: "/app/logistics",
            label: "title",
            namespace: "logistics",
            icon: FactoryIcon,
          },
          {
            href: "/app/quality-documents",
            label: "title",
            namespace: "qualityDocuments",
            icon: FileTextIcon,
          },
          {
            href: "/app/material-standards",
            label: "standards",
            namespace: "operations",
            icon: BoxesIcon,
          },
          {
            href: "/app/production",
            label: "production",
            namespace: "operations",
            icon: FactoryIcon,
          },
          {
            href: "/app/lots",
            label: "title",
            namespace: "lots",
            icon: BoxesIcon,
          },
          {
            href: "/app/evidence",
            label: "title",
            namespace: "evidence",
            icon: FileTextIcon,
          },
          {
            href: "/app/facility",
            label: "title",
            namespace: "facility",
            icon: FactoryIcon,
          },
        ]
      : roleMore;
  const itemLabel = (item: NavItem) => {
    if (item.namespace === "serviceRecords") return services("title");
    if (item.namespace === "returnClaims") return returnClaims("title");
    if (item.namespace === "sourcing") return sourcing("title");
    if (item.namespace === "logistics") return logistics("title");
    if (item.namespace === "qualityDocuments") return qualityDocuments("title");
    if (item.namespace === "operations")
      return operations(
        item.label === "production" ? "production" : "standards",
      );
    if (item.namespace === "lots") return lots("title");
    if (item.namespace === "facility") return facility("title");
    return item.namespace === "evidence"
      ? evidence("title")
      : t(`nav.${item.label}`);
  };
  const isSearchMatch = (item: NavItem) =>
    itemLabel(item).toLowerCase().includes(navSearch.trim().toLowerCase());
  // Daily tasks stay one tap away. Long translated labels scroll within the
  // bar rather than overflow the page or shrink below a readable size.
  const mobilePrimary = primary.slice(0, mobileCapacity);
  const mobileMore = [...primary.slice(mobileCapacity), ...more];
  const side =
    isLocale(locale) && localeDirection(locale) === "rtl" ? "left" : "right";
  const closeMenu = () => {
    setMenuOpen(false);
  };
  const help = `/help/${role}`;

  const link = (item: NavItem, className: string, isCompact = false) => {
    const Icon = item.icon;
    const isCurrent = isActive(pathname, item.href);
    return (
      <Link
        key={item.href + item.label}
        href={item.href}
        aria-current={isCurrent ? "page" : undefined}
        className={cn(
          className,
          isCurrent &&
            "border-s-primary bg-background font-semibold text-primary",
        )}
      >
        <Icon aria-hidden className="size-5 shrink-0" />
        <span
          className={isCompact ? "whitespace-nowrap" : "min-w-0 break-words"}
        >
          {itemLabel(item)}
        </span>
      </Link>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background xl:flex-row">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 border-e border-sidebar-border bg-muted/35 px-5 py-6 text-sidebar-foreground xl:flex">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <div className="shrink-0 border-y border-sidebar-border px-2 py-5">
          <p className="font-display text-lg leading-tight font-semibold break-words">
            {name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`roles.${role}`)}
          </p>
        </div>
        <Input
          type="search"
          aria-label={common("search")}
          placeholder={common("search")}
          value={navSearch}
          onChange={(event) => {
            setNavSearch(event.target.value);
          }}
        />
        <nav
          aria-label={t("navLabel")}
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pe-1"
        >
          {primary
            .filter((item) => isSearchMatch(item))
            .map((item) =>
              link(
                item,
                "flex min-h-11 items-center gap-3 border-s-2 border-transparent px-3 text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
              ),
            )}
          {more.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1 border-t border-sidebar-border pt-2">
              {more
                .filter((item) => isSearchMatch(item))
                .map((item) =>
                  link(
                    item,
                    "flex min-h-11 items-center gap-3 border-s-2 border-transparent px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  ),
                )}
            </div>
          ) : null}
          <Link
            href={help}
            className="mt-2 flex min-h-11 items-center gap-3 border-s-2 border-transparent px-3 text-sm font-medium transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LifeBuoyIcon aria-hidden className="size-5" />
            {t("nav.help")}
          </Link>
          <AccountLinks className="border-s-2 border-transparent px-3 hover:bg-sidebar-accent" />
        </nav>
        <div className="flex shrink-0 flex-col gap-2 border-t border-sidebar-border pt-4">
          <NativeUpdateControl compact />
          <div className="flex items-center justify-between gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 text-foreground"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            <LogOutIcon aria-hidden />
            {t("signOut")}
          </Button>
        </div>
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-4 xl:hidden">
          <Link
            href="/"
            aria-label={t("homeLink")}
            className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo idPrefix="lg-bar" className="[&>svg]:size-7" />
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <NativeUpdateControl compact />
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={t("more")}
                onClick={(event) => {
                  menuOpener.current = event.currentTarget;
                }}
              >
                <EllipsisIcon aria-hidden />
              </Button>
            </SheetTrigger>
          </div>
        </header>
        <SheetContent
          side={side}
          className="gap-0 overflow-y-auto pb-[env(safe-area-inset-bottom)] data-[side=left]:w-full data-[side=right]:w-full"
          showCloseButton={false}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            // The header and bottom bar share a sheet. Return focus to the
            // actual opener, rather than Radix's last registered trigger.
            event.preventDefault();
            menuOpener.current?.focus();
          }}
        >
          <SheetHeader className="min-h-14 shrink-0 flex-row items-center justify-between px-5 py-2">
            <SheetTitle className="sr-only">{t("navLabel")}</SheetTitle>
            <Logo
              idPrefix="app-menu"
              className="gap-2 [&>span]:text-lg [&>svg]:size-7"
            />
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={navigation("closeMenu")}
              >
                <XIcon aria-hidden />
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="mx-5 border-b py-3">
            <p className="font-display text-lg leading-tight font-semibold break-words">
              {name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(`roles.${role}`)}
            </p>
          </div>
          <nav
            aria-label={t("navLabel")}
            className="mx-5 flex shrink-0 flex-col divide-y"
          >
            {mobileMore.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                aria-current={
                  isActive(pathname, item.href) ? "page" : undefined
                }
                className={cn(
                  "flex min-h-11 items-center gap-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive(pathname, item.href) && "font-semibold text-primary",
                )}
              >
                <item.icon aria-hidden className="size-5 shrink-0" />
                {itemLabel(item)}
              </Link>
            ))}
            <Link
              href={help}
              onClick={closeMenu}
              className="flex min-h-11 items-center gap-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <LifeBuoyIcon aria-hidden className="size-5 shrink-0" />
              {t("nav.help")}
            </Link>
            <AccountLinks onNavigate={closeMenu} />
          </nav>
          <div className="mx-5 grid shrink-0 border-t py-2">
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
          <div className="mx-5 shrink-0 border-t py-4">
            <Button
              variant="outline"
              className="min-h-11 w-full text-sm"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <LogOutIcon aria-hidden />
              {t("signOut")}
            </Button>
          </div>
        </SheetContent>
        <nav
          ref={mobileNavRef}
          aria-label={t("navLabel")}
          className="fixed inset-x-0 bottom-0 z-30 grid overflow-x-auto overscroll-x-contain border-t border-border bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] xl:hidden"
          style={{
            gridTemplateColumns: `repeat(${String(mobilePrimary.length + 1)}, minmax(max-content, 1fr))`,
          }}
        >
          {mobilePrimary.map((item) =>
            link(
              item,
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-center text-sm font-medium text-muted-foreground outline-none focus-visible:bg-muted",
              true,
            ),
          )}
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              onClick={(event) => {
                menuOpener.current = event.currentTarget;
              }}
              className={cn(
                "h-auto min-h-14 flex-col gap-1 rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground",
                mobileMore.some((item) => isActive(pathname, item.href)) &&
                  "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <EllipsisIcon aria-hidden className="size-5" />
              {t("more")}
            </Button>
          </SheetTrigger>
        </nav>
      </Sheet>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-8 px-4 pt-6 pb-28 sm:px-8 xl:px-12 xl:pt-10 xl:pb-16"
      >
        <WorkspacePermissions
          key={
            workspace.kind === "org"
              ? `${workspace.org.id}-${workspace.role}`
              : "saathi"
          }
          membershipRole={workspace.kind === "org" ? workspace.role : "member"}
        >
          {children}
        </WorkspacePermissions>
      </main>
    </div>
  );
}
