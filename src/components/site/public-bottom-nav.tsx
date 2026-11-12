"use client";

import { CircleHelpIcon, HouseIcon, RecycleIcon, TagsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const destinations = [
  { href: "/", label: "home", icon: HouseIcon },
  { href: "/sell", label: "sellScrap", icon: RecycleIcon },
  { href: "/prices", label: "prices", icon: TagsIcon },
  { href: "/help", label: "help", icon: CircleHelpIcon },
] as const;

/** Public routes only: the workspace and authentication layouts own their chrome. */
export function PublicBottomNav() {
  const t = useTranslations("nav");
  const footer = useTranslations("footer");
  const pathname = usePathname();
  const dock = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(128);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const updateFocus = () => {
      setEditing(
        Boolean(
          document.activeElement?.matches(
            "input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=true]",
          ),
        ),
      );
    };
    document.addEventListener("focusin", updateFocus);
    document.addEventListener("focusout", updateFocus);
    return () => {
      document.removeEventListener("focusin", updateFocus);
      document.removeEventListener("focusout", updateFocus);
    };
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !dock.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = entry.target.getBoundingClientRect().height;
      if (measured) setHeight(measured);
    });
    observer.observe(dock.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div aria-hidden className="shrink-0 xl:hidden" style={{ height }} />
      <div
        ref={dock}
        hidden={editing}
        className="fixed inset-x-0 bottom-0 z-30 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden"
      >
        <nav
          aria-label={footer("useHeading")}
          className="record-sheet mx-auto grid max-w-md grid-cols-4 items-stretch gap-1 rounded-[2rem] border border-border p-2 shadow-panel"
        >
          {destinations.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="group flex min-h-16 min-w-0 flex-col items-center justify-start gap-1 rounded-3xl px-1 py-1 text-center text-xs font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="max-w-full leading-snug [overflow-wrap:anywhere] break-words">
                  {t(label)}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
