"use client";

import { ChevronDownIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isLocale, localeMeta, locales } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Switches language in place: `/how-it-works` → `/ta/how-it-works`. */
export function LanguageSwitcher({ className }: { className?: string } = {}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const current = localeMeta[isLocale(locale) ? locale : "en"];

  function onChange(next: string) {
    if (next === locale || !isLocale(next)) return;
    startTransition(() => {
      // The query can hold a return path or filter, and the hash a help section.
      router.replace(
        `${pathname}${window.location.search}${window.location.hash}`,
        { locale: next },
      );
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`min-h-11 gap-1.5 px-2 text-sm font-medium ${className ?? ""}`}
          aria-label={`${t("language")}: ${current.label}`}
          disabled={isPending}
        >
          <span lang={current.hreflang} dir={current.dir}>
            {current.label}
          </span>
          <ChevronDownIcon aria-hidden="true" className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(32rem,70dvh)] min-w-48 overflow-y-auto"
      >
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={onChange}>
          {locales.map((code) => (
            <DropdownMenuRadioItem
              key={code}
              value={code}
              lang={localeMeta[code].hreflang}
              dir={localeMeta[code].dir}
              className="min-h-11"
            >
              {localeMeta[code].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
