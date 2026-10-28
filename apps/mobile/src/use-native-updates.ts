import Constants from "expo-constants";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { WebView } from "react-native-webview";

import {
  isUpdateHome,
  parseMobileUpdate,
  updateBridgeScript,
} from "../../shared/update-bridge.mjs";
import { useShellUpdates } from "./use-updates";

/** Native restart requires a second response from the frozen current document.
 * Navigation invalidates that response. No frame can supply a URL or command. */
export function useNativeUpdates({
  origin,
  currentUrl,
  webView,
}: {
  origin: string;
  currentUrl: RefObject<string>;
  webView: RefObject<Pick<WebView, "injectJavaScript"> | null>;
}) {
  const updates = useShellUpdates();
  const generation = useRef(0);
  const alive = useRef(true);
  const pending = useRef<{
    proof: string;
    url: string;
    generation: number;
  } | null>(null);
  const initialCheck = useRef(false);
  const script = updateBridgeScript(
    origin,
    Constants.sessionId,
    updates.state,
    "mobile",
  );
  const inject = (code: string) => webView.current?.injectJavaScript(code);
  const ready = () => {
    inject(script);
  };
  useEffect(() => {
    webView.current?.injectJavaScript(script);
  }, [script, webView]);
  useEffect(() => {
    if (initialCheck.current || updates.state !== "idle") {
      return;
    }

    initialCheck.current = true;
    void updates.check();
  }, [updates]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current = null;
    };
  }, []);
  const invalidate = useCallback(() => {
    generation.current += 1;
    pending.current = null;
  }, []);
  const receive = async (raw: string, frameUrl: string) => {
    if (!alive.current) return;
    const action = parseMobileUpdate(
      raw,
      frameUrl,
      currentUrl.current,
      origin,
      Constants.sessionId,
    );
    if (!action) {
      if (
        !pending.current ||
        raw.length > 512 ||
        frameUrl !== pending.current.url ||
        frameUrl !== currentUrl.current ||
        pending.current.generation !== generation.current
      )
        return;
      try {
        const proof: unknown = JSON.parse(raw);
        if (
          !proof ||
          typeof proof !== "object" ||
          Object.keys(proof).length !== 4 ||
          !("type" in proof) ||
          proof.type !== "luma.update.apply" ||
          !("nonce" in proof) ||
          proof.nonce !== Constants.sessionId ||
          !("proof" in proof) ||
          proof.proof !== pending.current.proof ||
          !("expiresAt" in proof) ||
          typeof proof.expiresAt !== "number" ||
          !Number.isSafeInteger(proof.expiresAt) ||
          proof.expiresAt <= Date.now() ||
          proof.expiresAt > Date.now() + 10_000
        )
          return;
        pending.current = null;
        if (isUpdateHome(frameUrl, origin)) await updates.restart(true);
      } catch {
        /* Unrelated or malformed WebView messages are ignored. */
      }
      return;
    }
    if (action === "status") ready();
    else if (action === "check") await updates.check();
    else if (updates.state === "ready" && isUpdateHome(frameUrl, origin)) {
      const proof = String(Date.now()) + "-" + String(generation.current);
      pending.current = {
        proof,
        url: frameUrl,
        generation: generation.current,
      };
      const payload = JSON.stringify({
        type: "luma.update.apply",
        nonce: Constants.sessionId,
        proof,
      });
      webView.current?.injectJavaScript(
        "if(window.location.href===" +
          JSON.stringify(frameUrl) +
          "&&window.lumaAppUpdates?.isRestartPending()){var message=" +
          payload +
          ";message.expiresAt=window.lumaAppUpdates.getRestartDeadline();" +
          "window.ReactNativeWebView.postMessage(JSON.stringify(message));}true;",
      );
    } else {
      webView.current?.injectJavaScript(
        updateBridgeScript(origin, Constants.sessionId, "blocked", "mobile"),
      );
    }
  };
  return { script, ready, receive, invalidate };
}
