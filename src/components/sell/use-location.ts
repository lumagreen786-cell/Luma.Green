"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Point } from "../../../convex/lib/households";

export type LocationState =
  | { status: "off" }
  | { status: "locating" }
  | { status: "on"; point: Point }
  | { status: "failed" };

/** About 100 m: enough to sort shops, not enough to find a door. */
function coarse(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * "Use my location", only when the household asks. The point stays in this
 * page until booking. Pickup confirmation explains that the approximate
 * point is saved with the booking for nearby-shop dispatch.
 */
export function useLocation(
  precision: "nearby" | "building" = "nearby",
  onLocation?: (point: Point) => void,
) {
  const [state, setState] = useState<LocationState>({ status: "off" });

  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "failed" });
      return;
    }
    const current = ++generation.current;
    setState({ status: "locating" });
    const requiresPreciseLocation = precision === "building";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (current !== generation.current) return;
        const { latitude, longitude, accuracy } = position.coords;
        if (
          requiresPreciseLocation &&
          (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 30)
        ) {
          setState({ status: "failed" });
          return;
        }
        const point = {
          lat: requiresPreciseLocation ? latitude : coarse(latitude),
          lng: requiresPreciseLocation ? longitude : coarse(longitude),
        };
        if (onLocation) {
          setState({ status: "off" });
          onLocation(point);
        } else {
          setState({ status: "on", point });
        }
      },
      () => {
        if (current !== generation.current) return;
        setState({ status: "failed" });
      },
      {
        enableHighAccuracy: requiresPreciseLocation,
        timeout: 15_000,
        maximumAge: requiresPreciseLocation ? 0 : 300_000,
      },
    );
  }, [onLocation, precision]);

  const stop = useCallback(() => {
    generation.current += 1;
    setState({ status: "off" });
  }, []);

  return {
    state,
    point: state.status === "on" ? state.point : undefined,
    locate,
    stop,
  };
}
