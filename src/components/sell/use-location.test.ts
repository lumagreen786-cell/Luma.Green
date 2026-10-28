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
