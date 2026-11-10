"use client";

import { LogOutIcon, MenuIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { isConvexConfigured } from "@/components/providers/convex-provider";
import { LanguageSwitcher } from "@/components/site/language-switcher";
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
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

import { AccountLinks } from "./account-links";
import { useSignOut } from "./use-sign-out";

/** The same compact settings menu serves households and approved operators. */
export function AccountMenu() {
  const nav = useTranslations("nav");
  const common = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label={nav("openMenu")}>
          <MenuIcon aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={
          isLocale(locale) && localeDirection(locale) === "rtl"
            ? "left"
            : "right"
        }
        className="gap-0 overflow-y-auto pb-[env(safe-area-inset-bottom)] data-[side=left]:w-full data-[side=right]:w-full"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <SheetHeader className="min-h-16 shrink-0 flex-row items-center justify-between px-5 py-2">
          <SheetTitle className="sr-only">{nav("label")}</SheetTitle>
          <Logo
            idPrefix="account-menu"
            className="gap-2 [&>span]:text-lg [&>svg]:size-7"
          />
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={nav("closeMenu")}
            >
              <XIcon aria-hidden />
            </Button>
          </SheetClose>
        </SheetHeader>
        <nav
          aria-label={nav("label")}
          className="mx-5 flex shrink-0 flex-col divide-y"
        >
          <AccountLinks onNavigate={close} />
          <Link
            href="/"
            onClick={close}
            className="flex min-h-12 items-center py-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {nav("home")}
          </Link>
        </nav>
        <div className="mx-5 grid shrink-0 border-t py-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {common("language")}
            </span>
            <LanguageSwitcher />
          </div>
        </div>
        <div className="mx-5 shrink-0 border-t py-4">
          {isConvexConfigured ? (
            <ConnectedAccountAction onNavigate={close} />
          ) : (
            <SignInAction onNavigate={close} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SignInAction({ onNavigate }: { onNavigate: () => void }) {
  const auth = useTranslations("auth");
  return (
    <Button asChild variant="outline" className="w-full">
      <Link href="/login" onClick={onNavigate}>
        {auth("metaTitle")}
      </Link>
    </Button>
  );
}

function ConnectedAccountAction({ onNavigate }: { onNavigate: () => void }) {
  const app = useTranslations("app");
  const session = authClient.useSession();
  const router = useRouter();
  const { signOut, busy } = useSignOut(() => {
    router.replace("/login");
  });
  return session.data ? (
    <Button
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={() => void signOut()}
    >
      <LogOutIcon aria-hidden />
      {app("signOut")}
    </Button>
  ) : (
    <SignInAction onNavigate={onNavigate} />
  );
}
