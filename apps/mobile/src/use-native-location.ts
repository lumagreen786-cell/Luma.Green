import Constants from "expo-constants";
import * as Location from "expo-location";
import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import type { WebView } from "react-native-webview";

import {
  locationBridgeScript,
  type LocationResult,
  locationResultScript,
  parseLocationRequest,
  type WebPosition,
} from "./location-policy";

/** Location is requested only by the trusted page's getCurrentPosition call. */
export function useNativeLocation({
  origin,
  currentUrl,
  webView,
}: {
  origin: string;
  currentUrl: RefObject<string>;
  webView: RefObject<WebView | null>;
}) {
  const alive = useRef(true);
  const generation = useRef(0);
  const busy = useRef(false);
  const script = useMemo(
    () => locationBridgeScript(origin, Constants.sessionId),
    [origin],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
    };
  }, []);

  const invalidate = useCallback(() => {
    generation.current += 1;
  }, []);

  const receive = useCallback(
    async (raw: string, frameUrl: string) => {
      const documentUrl = currentUrl.current;
      const request = parseLocationRequest(
        raw,
        frameUrl,
        documentUrl,
        origin,
        Constants.sessionId,
      );
      if (!request || !alive.current) return;
      const requestGeneration = generation.current;
      const isCurrent = () =>
        alive.current &&
        generation.current === requestGeneration &&
        currentUrl.current === documentUrl;
      const reply = (result: LocationResult) => {
        if (isCurrent())
          webView.current?.injectJavaScript(
            locationResultScript(documentUrl, result),
          );
      };
      const fail = (code: 1 | 2 | 3) => {
        reply({ requestId: request.requestId, error: { code, message: "" } });
      };
      if (busy.current) {
        fail(2);
        return;
      }
      if (request.options.timeout === 0) {
        fail(3);
        return;
      }
      busy.current = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waiting = { isExpired: false };
      const canReply = () => !waiting.isExpired && isCurrent();
      try {
        const task = async () => {
          try {
            // Expo requests coarse and fine together; approximate-only access is valid.
            const permission =
              await Location.requestForegroundPermissionsAsync();
            if (!canReply()) return;
            if (!permission.granted) {
              fail(1);
              return;
            }
            const position = await Location.getCurrentPositionAsync({
              accuracy: request.options.enableHighAccuracy
                ? Location.Accuracy.High
                : Location.Accuracy.Balanced,
            });
            if (!canReply()) return;
            const {
              latitude,
              longitude,
              accuracy,
              altitude,
              altitudeAccuracy,
              heading,
              speed,
            } = position.coords;
            if (
              accuracy === null ||
              latitude < -90 ||
              latitude > 90 ||
              longitude < -180 ||
              longitude > 180 ||
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude) ||
              !Number.isFinite(accuracy) ||
              accuracy < 0 ||
              !Number.isFinite(position.timestamp)
            ) {
              fail(2);
              return;
            }
            const optional = (value: number | null) =>
              value !== null && Number.isFinite(value) && value >= 0
                ? value
                : null;
            const webPosition: WebPosition = {
              timestamp: position.timestamp,
              coords: {
                latitude,
                longitude,
                accuracy,
                altitude:
                  altitude !== null && Number.isFinite(altitude)
                    ? altitude
                    : null,
                altitudeAccuracy: optional(altitudeAccuracy),
                heading: optional(heading),
                speed: optional(speed),
              },
            };
            reply({ requestId: request.requestId, position: webPosition });
          } finally {
            busy.current = false;
          }
        };
        await Promise.race([
          task(),
          new Promise<void>((resolve) => {
            timer = setTimeout(() => {
              waiting.isExpired = true;
              fail(3);
              resolve();
            }, request.options.timeout);
          }),
        ]);
      } catch {
        if (!waiting.isExpired) fail(2);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    },
    [currentUrl, origin, webView],
  );

  return { script, receive, invalidate };
}
