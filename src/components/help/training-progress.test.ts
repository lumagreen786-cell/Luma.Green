import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_HELP } from "./content";
import {
  parseDone,
  trainingStorageKey,
  useTrainingProgress,
} from "./training-progress";

const kabadiwala = ROLE_HELP.kabadiwala.training;

describe("useTrainingProgress", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with nothing done", () => {
    const { result } = renderHook(() => useTrainingProgress("kabadiwala"));
    expect(result.current.done).toEqual([]);
    expect(result.current.total).toBe(kabadiwala.length);
    expect(result.current.isComplete).toBe(false);
  });

  it("remembers a lesson marked done, even after a reload", () => {
    const first = renderHook(() => useTrainingProgress("kabadiwala"));
    act(() => {
      first.result.current.setDone("weighingFairly", true);
    });
    expect(first.result.current.isDone("weighingFairly")).toBe(true);
    const saved = window.localStorage.getItem(trainingStorageKey("kabadiwala"));
    expect(JSON.parse(saved ?? "")).toEqual(["weighingFairly"]);
    first.unmount();

    const again = renderHook(() => useTrainingProgress("kabadiwala"));
    expect(again.result.current.done).toEqual(["weighingFairly"]);
  });

  it("is complete only when every lesson is done, and can start again", () => {
    const { result } = renderHook(() => useTrainingProgress("kabadiwala"));
    act(() => {
      for (const key of kabadiwala) result.current.setDone(key, true);
    });
    expect(result.current.isComplete).toBe(true);

    act(() => {
      result.current.setDone("usingTheApp", false);
    });
    expect(result.current.isComplete).toBe(false);
    expect(result.current.done).not.toContain("usingTheApp");

    act(() => {
      result.current.reset();
    });
    expect(result.current.done).toEqual([]);
  });

  it("keeps each role's progress apart", () => {
    const kabadi = renderHook(() => useTrainingProgress("kabadiwala"));
    const saathi = renderHook(() => useTrainingProgress("saathi"));
    act(() => {
      kabadi.result.current.setDone("safeHandling", true);
    });
    expect(kabadi.result.current.done).toEqual(["safeHandling"]);
    // The Saathi path has the same lesson, but its own progress.
    expect(saathi.result.current.done).toEqual([]);
  });

  it("updates every view of the same path at once", () => {
    const one = renderHook(() => useTrainingProgress("yard"));
    const two = renderHook(() => useTrainingProgress("yard"));
    act(() => {
      one.result.current.setDone("siteSafety", true);
    });
    expect(two.result.current.done).toEqual(["siteSafety"]);
  });

  it("still works for the visit when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { result } = renderHook(() => useTrainingProgress("manufacturer"));
    expect(result.current.done).toEqual([]);

    act(() => {
      result.current.setDone("eprBasics", true);
    });
    expect(result.current.done).toEqual(["eprBasics"]);

    // Leave nothing behind for the next test.
    act(() => {
      result.current.reset();
    });
  });

  it("keeps new progress when full storage can read an older saved value", () => {
    const key = trainingStorageKey("manufacturer");
    window.localStorage.setItem(key, JSON.stringify(["eprBasics"]));
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    const { result } = renderHook(() => useTrainingProgress("manufacturer"));

    act(() => {
      result.current.setDone("eprBasics", false);
    });
    expect(result.current.done).toEqual([]);

    act(() => {
      result.current.setDone("eprBasics", true);
    });
    expect(result.current.done).toEqual(["eprBasics"]);

    write.mockRestore();
    act(() => {
      result.current.reset();
    });
    expect(window.localStorage.getItem(key)).toBe("[]");
    expect(result.current.done).toEqual([]);
  });
});

describe("parseDone", () => {
  it("ignores anything that isn't a saved list", () => {
    expect(parseDone("", kabadiwala)).toEqual([]);
    expect(parseDone("not json", kabadiwala)).toEqual([]);
    expect(parseDone('{"usingTheApp":true}', kabadiwala)).toEqual([]);
  });

  it("keeps only real lessons, in course order", () => {
    expect(
      parseDone(
        JSON.stringify(["sellingToYards", "made-up", 7, "usingTheApp"]),
        kabadiwala,
      ),
    ).toEqual(["usingTheApp", "sellingToYards"]);
  });
});
