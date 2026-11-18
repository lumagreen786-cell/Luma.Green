"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import styles from "./motion.module.css";
import { useIsReducedMotion } from "./motion-preference";

const audiences = ["apartments", "coffeeShops", "offices"] as const;
export function RotatingAudience({ className }: { className?: string }) {
  const t = useTranslations("afterlifeMotion");
  const isReduced = useIsReducedMotion();
  const root = useRef<HTMLSpanElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (isReduced || !visible) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden")
        setIndex((previous) => (previous + 1) % audiences.length);
    }, 3200);
    return () => {
      window.clearInterval(timer);
    };
  }, [isReduced, visible]);
  useEffect(() => {
    const element = word.current;
    if (isReduced || !element) return;
    let isStopped = false;
    let revert: (() => void) | undefined;
    void import("gsap")
      .then(({ gsap }) => {
        if (isStopped) return;
        const context = gsap.context(() => {
          gsap.fromTo(
            element,
            { y: 7, opacity: 0.25 },
            {
              y: 0,
              opacity: 1,
              duration: 0.45,
              ease: "power3.out",
              clearProps: "transform,opacity",
            },
          );
        }, element);
        revert = () => {
          context.revert();
        };
      })
      .catch(() => {
        /* The audience text stays visible without motion. */
      });
    return () => {
      isStopped = true;
      revert?.();
    };
  }, [index, isReduced]);
  return (
    <span ref={root} className={cn(styles.audience, className)}>
      <span className="sr-only">{t("audiences")}</span>
      <span
        ref={word}
        aria-hidden="true"
        className={styles.word}
        key={isReduced ? 0 : index}
      >
        {t(audiences[isReduced ? 0 : index])}
      </span>
    </span>
  );
}
