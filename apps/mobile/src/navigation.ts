import {
  defaultLocale,
  isLocale,
  type Locale,
} from "../../../src/i18n/locales.ts";

export type NavigationDecision =
  "internal" | "browser" | "external" | "blocked";

/** This grants no top-level navigation, native bridge, or device permission. */
export function isBotChallengeFrame(
  value: string,
  isTopFrame: boolean | undefined,
): boolean {
  if (isTopFrame !== false) return false;
  // Turnstile creates local empty/srcdoc frames before the remote challenge.
  if (value === "about:blank" || value === "about:srcdoc") return true;
  try {
    const url = new URL(value);
    return (
      url.origin === "https://challenges.cloudflare.com" &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith("/cdn-cgi/challenge-platform/")
    );
  } catch {
    return false;
  }
}

interface NavigationState {
  url: string;
  canGoBack: boolean;
}

/** Recover even when a navigation bypassed the native request callback. */
export function handleNavigationChange(
  state: NavigationState,
  origin: string,
  handlers: {
    trackTrusted: (state: NavigationState) => void;
    stopLoading: () => void;
    openExternal: (url: string) => void;
    restoreTrusted: () => void;
  },
) {
  // Native startup/error documents do not replace the last trusted URL. A
  // remount here would repeat the same callback forever. The request policy
  // still rejects these URLs when page content tries to navigate to them.
  if (
    !state.url ||
    state.url === "about:blank" ||
    state.url === "chrome-error://chromewebdata/"
  )
    return;
  const decision = classifyNavigation(state.url, origin);
  if (decision === "internal") {
    handlers.trackTrusted(state);
    return;
  }
  handlers.stopLoading();
  if (decision !== "blocked") handlers.openExternal(state.url);
  handlers.restoreTrusted();
}

/** Only an exact app origin owns the authenticated web view. */
export function classifyNavigation(
  value: string,
  origin: string,
): NavigationDecision {
  let url: URL;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\u{0}-\u{1F}\u{7F}]/u.test(decoded)) return "blocked";
    url = new URL(value);
  } catch {
    return "blocked";
  }
  if (url.username || url.password) return "blocked";
  if (["https:", "http:"].includes(url.protocol) && url.origin === origin) {
    let path: string;
    try {
      path = decodeURIComponent(url.pathname).replaceAll("\\", "/");
    } catch {
      return "blocked";
    }
    return /^\/+admin(?:\/|$)/i.test(path) ? "browser" : "internal";
  }
  if (url.protocol === "https:") return "external";
  if (url.search || url.hash || url.host) return "blocked";
  const payload = decodeURIComponent(url.pathname);
  if (url.protocol === "mailto:" && /^[^\s?@]+@[^\s?@]+$/u.test(payload))
    return "external";
  return url.protocol === "tel:" &&
    /^\+?[\d(). -]+$/u.test(payload) &&
    /\d/u.test(payload)
    ? "external"
    : "blocked";
}

export function localeFromLanguage(
  language: string | null | undefined,
): Locale {
  const base = language?.split(/[-_]/, 1)[0]?.toLowerCase();
  return base && isLocale(base) ? base : defaultLocale;
}

export function localeFromUrl(value: string, current: Locale): Locale {
  try {
    const segment = new URL(value).pathname.split("/", 2)[1];
    // The shared Next router omits the English prefix (localePrefix: as-needed).
    return segment && isLocale(segment) ? segment : defaultLocale;
  } catch {
    return current;
  }
}
