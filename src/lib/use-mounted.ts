"use client";

import { useCallback, useEffect, useRef } from "react";

/** A late response must not continue a workflow after its screen is removed. */
export function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(() => mounted.current, []);
}

/** Stop the next async step; the owner catch decides whether to show an error. */
export function assertMounted(isMounted: () => boolean) {
  if (!isMounted()) throw new Error("WORKFLOW_CANCELLED");
}
