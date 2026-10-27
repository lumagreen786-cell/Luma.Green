"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "luma-view-preference";
function subscribe(changed: () => void) {
  window.addEventListener(EVENT, changed);
  return () => {
    window.removeEventListener(EVENT, changed);
  };
}

/** Only non-sensitive view choices belong here, never records or form inputs. */
export function useViewPreference(key: string, fallback: string) {
  const storageKey = `lg.view.${key}`;
  const read = useCallback(() => {
    try {
      return sessionStorage.getItem(storageKey) ?? fallback;
    } catch {
      return fallback;
    }
  }, [storageKey, fallback]);
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const setValue = useCallback(
    (next: string) => {
      try {
        sessionStorage.setItem(storageKey, next);
      } catch {
        /* Storage can be blocked; the caller keeps its local selection. */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [storageKey],
  );
  return [value, setValue] as const;
}
