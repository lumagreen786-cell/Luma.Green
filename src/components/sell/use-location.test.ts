import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useLocation } from "./use-location";

afterEach(() => vi.unstubAllGlobals());
it("ignores a delayed location after stop or a newer request", () => {
  const reads: PositionCallback[] = [];
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (success: PositionCallback) => {
        reads.push(success);
      },
    },
  });
  const h = renderHook(useLocation);
  act(() => {
    h.result.current.locate();
  });
  act(() => {
    h.result.current.stop();
  });
  act(() => {
    reads[0]({
      coords: { latitude: 12.97, longitude: 77.59 },
    } as GeolocationPosition);
  });
  expect(h.result.current.state.status).toBe("off");
  act(() => {
    h.result.current.locate();
    h.result.current.locate();
  });
  act(() => {
    reads[1]({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition);
  });
  expect(h.result.current.state.status).toBe("locating");
  act(() => {
    reads[2]({
      coords: { latitude: 12.97123, longitude: 77.59123 },
    } as GeolocationPosition);
  });
  expect(h.result.current.point).toEqual({ lat: 12.971, lng: 77.591 });
  h.unmount();
});

it("requires a precise position for roof checks and does not keep the delivered point in state", () => {
  const reads: PositionCallback[] = [];
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (success: PositionCallback) => {
        reads.push(success);
      },
    },
  });
  const onLocation = vi.fn();
  const h = renderHook(() => useLocation("building", onLocation));
  act(() => {
    h.result.current.locate();
    reads[0]({
      coords: { latitude: 12.97123, longitude: 77.59123, accuracy: 31 },
    } as GeolocationPosition);
  });
  expect(h.result.current.state.status).toBe("failed");
  expect(onLocation).not.toHaveBeenCalled();
  act(() => {
    h.result.current.locate();
    reads[1]({
      coords: { latitude: 12.97123, longitude: 77.59123, accuracy: 20 },
    } as GeolocationPosition);
  });
  expect(onLocation).toHaveBeenCalledWith({ lat: 12.97123, lng: 77.59123 });
  expect(h.result.current.point).toBeUndefined();
  h.unmount();
});
