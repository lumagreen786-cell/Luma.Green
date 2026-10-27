"use client";

import { type RefObject, useEffect, useState } from "react";

/** Keep More reachable when translated daily labels need additional space. */
export function useMobileNavCapacity(
  ref: RefObject<HTMLElement | null>,
  locale: string,
  isReady: boolean,
) {
  const [capacity, setCapacity] = useState(4);
  useEffect(() => {
    const bar = ref.current;
    if (!bar || !isReady) return;
    let previousWidth = bar.clientWidth;
    let isActive = true;
    const measure = () => {
      if (!isActive || bar.clientWidth === 0) return;
      if (bar.clientWidth > previousWidth + 1 && capacity < 4) setCapacity(4);
      else if (bar.scrollWidth > bar.clientWidth + 1) {
        setCapacity((count) => Math.max(2, count - 1));
      }
      previousWidth = bar.clientWidth;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    void document.fonts.ready.then(measure);
    return () => {
      isActive = false;
      observer.disconnect();
    };
  }, [capacity, locale, ref, isReady]);
  return capacity;
}
