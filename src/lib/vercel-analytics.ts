import type * as VercelAnalytics from "@vercel/analytics";
import type { BeforeSendEvent } from "@vercel/analytics";

import { analyticsPage, readAnalyticsChoice } from "./analytics";
import { clientEnv } from "./env";

const origins = new Set([
  "https://luma.green",
  "https://www.luma.green",
  "https://business.luma.green",
]);
const runtime: { initialization?: Promise<typeof VercelAnalytics> } = {};

/** Do not pass query strings, fragments, credentials or unapproved origins. */
export function isVercelPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      origins.has(url.origin) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      analyticsPage(url.pathname, url.hostname) !== undefined
    );
  } catch {
    return false;
  }
}

function hasNoStoredAttribution() {
  try {
    // Vendor-specific fail-closed guard; re-audit when the hosted runtime changes.
    return localStorage.getItem("__va_attribution") === null;
  } catch {
    return false;
  }
}

function isPermitted() {
  return (
    clientEnv.NEXT_PUBLIC_TELEMETRY_ENABLED &&
    clientEnv.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED &&
    readAnalyticsChoice() !== "denied" &&
    hasNoStoredAttribution() &&
    isVercelPublicUrl(window.location.href) &&
    (!document.referrer || isVercelPublicUrl(document.referrer))
  );
}

export function beforeVercelSend(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  const page = analyticsPage(
    window.location.pathname,
    window.location.hostname,
  );
  if (
    !page ||
    event.type !== "pageview" ||
    !isPermitted() ||
    !isVercelPublicUrl(event.url)
  )
    return null;
  const eventUrl = new URL(event.url);
  return eventUrl.origin === window.location.origin &&
    analyticsPage(eventUrl.pathname, eventUrl.hostname) === page
    ? { type: "pageview", url: window.location.origin + page }
    : null;
}

/** Manual public counts; enable only after deployment configuration checks. */
export async function recordVercelPageView(page: string) {
  if (!isPermitted()) return;
  runtime.initialization ??= import("@vercel/analytics");
  let sdk: typeof VercelAnalytics;
  try {
    sdk = await runtime.initialization;
  } catch (error) {
    runtime.initialization = undefined;
    throw error;
  }
  if (
    !isPermitted() ||
    analyticsPage(window.location.pathname, window.location.hostname) !== page
  )
    return;
  sdk.inject({
    disableAutoTrack: true,
    debug: false,
    beforeSend: beforeVercelSend,
  });
  sdk.pageview({ route: page, path: page });
}
