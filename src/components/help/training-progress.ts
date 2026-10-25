import { useCallback, useMemo, useSyncExternalStore } from "react";

import { type HelpRole, type ModuleKey, ROLE_HELP } from "./content";

/**
 * Which training lessons someone has marked done, per role, kept in this
 * browser's localStorage. Storage can be missing or blocked (private mode,
 * site data off), so every access is guarded and falls back to memory for
 * the rest of the visit — the page must work either way.
 */

const PREFIX = "luma.help.training.";
const CHANGED = "luma:help-training";

/** Progress that couldn't be saved to localStorage, kept for this visit. */
const unsaved = new Map<string, string>();

export function trainingStorageKey(role: HelpRole): string {
  return `${PREFIX}${role}`;
}

function readRaw(role: HelpRole): string {
  const key = trainingStorageKey(role);
  // A failed write is newer than the value still readable in full storage.
  const pending = unsaved.get(key);
  if (pending !== undefined) return pending;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // Blocked storage: fall through to what this visit remembers.
  }
  return unsaved.get(key) ?? "";
}

function writeRaw(role: HelpRole, value: string) {
  const key = trainingStorageKey(role);
  try {
    window.localStorage.setItem(key, value);
    unsaved.delete(key);
  } catch {
    // Blocked or full: remember it for the rest of this visit instead.
    unsaved.set(key, value);
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** The done lessons in `raw`, keeping only real ones, in course order. */
export function parseDone(
  raw: string,
  modules: readonly ModuleKey[],
): ModuleKey[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const saved = value as unknown[];
    return modules.filter((key) => saved.includes(key));
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export interface TrainingProgress {
  done: readonly ModuleKey[];
  isDone: (key: ModuleKey) => boolean;
  setDone: (key: ModuleKey, isDone: boolean) => void;
  reset: () => void;
  total: number;
  isComplete: boolean;
}

export function useTrainingProgress(role: HelpRole): TrainingProgress {
  const modules = ROLE_HELP[role].training;
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(role),
    // Nothing is known on the server; the browser fills it in.
    () => "",
  );
  const done = useMemo(() => parseDone(raw, modules), [raw, modules]);

  const setDone = useCallback(
    (key: ModuleKey, isDone: boolean) => {
      const current = parseDone(readRaw(role), modules);
      const next = modules.filter((module) =>
        module === key ? isDone : current.includes(module),
      );
      writeRaw(role, JSON.stringify(next));
    },
    [role, modules],
  );

  const reset = useCallback(() => {
    writeRaw(role, "[]");
  }, [role]);

  return {
    done,
    isDone: (key) => done.includes(key),
    setDone,
    reset,
    total: modules.length,
    isComplete: modules.length > 0 && done.length === modules.length,
  };
}
