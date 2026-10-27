"use client";

import { useEffect } from "react";

/** Restore a list after its records load; save only the viewport position. */
export function useListScroll(key: string, isReady: boolean) {
  useEffect(() => {
    if (!isReady) return;
    const storageKey = `lg.view.scroll.${key}`;
    let frame: number | undefined;
    try {
      const stored = sessionStorage.getItem(storageKey);
      const top = stored === null ? 0 : Number(stored);
      if (Number.isFinite(top) && top > 0) {
        frame = requestAnimationFrame(() => {
          window.scrollTo({ top });
        });
      }
    } catch {
      /* Storage is optional. */
    }
    const remember = () => {
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        /* Navigation must work with blocked storage. */
      }
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", remember);
    };
  }, [key, isReady]);
}
