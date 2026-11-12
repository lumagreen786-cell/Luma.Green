"use client";

import { CircleIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import styles from "./material-marquee.module.css";

const families = [
  "paper",
  "plastic",
  "metal",
  "glass",
  "ewaste",
  "other",
] as const;

/** A material index, with one readable list and a decorative loop copy. */
export function MaterialMarquee() {
  const t = useTranslations("home.marquee");
  const material = useTranslations("prices.families");
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = region.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      setInView(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={region}
      role="region"
      aria-label={t("label")}
      className="flex min-w-0 items-center gap-3 border-b bg-muted/30 px-4 sm:px-6"
    >
      <div className={cn("min-w-0 flex-1 overflow-hidden", styles.viewport)}>
        <div className={styles.track} data-paused={paused} data-active={inView}>
          {[false, true].map((duplicate) => (
            <ul
              key={String(duplicate)}
              aria-hidden={duplicate || undefined}
              className={cn(
                "flex shrink-0 items-center gap-8 py-5 pe-8 sm:gap-12 sm:pe-12",
                styles.list,
                duplicate && styles.duplicate,
              )}
            >
              {families.map((family) => (
                <li
                  key={family}
                  className="flex items-center gap-8 font-display text-lg font-medium text-muted-foreground sm:gap-12 sm:text-xl"
                >
                  <span className="whitespace-nowrap">{material(family)}</span>
                  <CircleIcon
                    aria-hidden
                    className="size-1.5 shrink-0 fill-primary text-foreground"
                  />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("shrink-0", styles.control)}
        aria-label={t(paused ? "resume" : "pause")}
        onClick={() => {
          setPaused((current) => !current);
        }}
      >
        {paused ? <PlayIcon aria-hidden /> : <PauseIcon aria-hidden />}
      </Button>
    </div>
  );
}
