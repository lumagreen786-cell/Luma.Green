"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { useIsReducedMotion } from "./motion-preference";

/** Optional GSAP entrance; content is readable before hydration or on failure. */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const isReduced = useIsReducedMotion();
  useEffect(() => {
    const element = root.current;
    if (!element || isReduced || !("IntersectionObserver" in window)) return;
    let isStopped = false;
    let revert: (() => void) | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.every((entry) => !entry.isIntersecting)) return;
        observer.disconnect();
        void import("gsap")
          .then(({ gsap }) => {
            if (isStopped) return;
            const context = gsap.context(() => {
              gsap.fromTo(
                element,
                { y: 20, opacity: 0.7 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.65,
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
            /* Optional motion must not hide content on load failure. */
          });
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => {
      isStopped = true;
      observer.disconnect();
      revert?.();
    };
  }, [isReduced]);
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
