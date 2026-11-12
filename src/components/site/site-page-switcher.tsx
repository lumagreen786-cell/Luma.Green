"use client";

import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

import { navItems } from "./content";

export function SitePageSwitcher() {
  const t = useTranslations("nav");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline" aria-label={t("label")}>
          <LayoutGrid aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52 rounded-2xl p-2">
        {navItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className="min-h-11 rounded-xl">
              {t(item.key)}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/contact" className="min-h-11 rounded-xl">
            {t("contact")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
