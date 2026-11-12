"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { parseTheme } from "./theme";
import { useTheme } from "./theme-provider";

export function ThemeToggleControl({
  labels,
  className,
}: {
  labels: { label: string; light: string; dark: string; system: string };
  className?: string;
}) {
  const { preference, resolvedTheme, setTheme } = useTheme();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={labels.label}
          className={className}
        >
          <Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            setTheme(parseTheme(value));
          }}
        >
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" />
            {labels.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" />
            {labels.dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden="true" />
            {labels.system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  return (
    <ThemeToggleControl
      className={className}
      labels={{
        label: t("label"),
        light: t("light"),
        dark: t("dark"),
        system: t("system"),
      }}
    />
  );
}
