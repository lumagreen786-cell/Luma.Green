import {
  analyticsPage,
  analyticsProperties,
  readAnalyticsChoice,
} from "./analytics";
import { clientEnv } from "./env";
import { recordVercelPageView } from "./vercel-analytics";

const runtime: {
  controller?: AbortController;
  distinctId?: string;
  isStopped?: boolean;
} = {};
const ingestionOrigins = new Set([
  "https://us.i.posthog.com",
  "https://eu.i.posthog.com",
]);

function isPermitted() {
  return (
    !runtime.isStopped &&
    clientEnv.NEXT_PUBLIC_TELEMETRY_ENABLED &&
    readAnalyticsChoice() !== "denied" &&
    analyticsPage(window.location.pathname, window.location.hostname) !==
      undefined
  );
}

export function resumeAnalytics() {
  runtime.isStopped = false;
  if (runtime.controller?.signal.aborted) runtime.controller = undefined;
}

export function stopAnalytics() {
  runtime.isStopped = true;
  runtime.controller?.abort();
}

/** Cloud ingestion origins only; never put a project key on an arbitrary host. */
export function posthogCaptureUrl(host: string): string | undefined {
  try {
    const url = new URL(host);
    return !ingestionOrigins.has(url.origin) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
      ? undefined
      : `${url.origin}/capture/`;
  } catch {
    return undefined;
  }
}

/** Manual public counts only. No SDK queues, automatic events or retry path. */
export async function recordPageView(page: string, locale: string) {
  if (
    !isPermitted() ||
    analyticsPage(window.location.pathname, window.location.hostname) !== page
  )
    return;
  try {
    await recordVercelPageView(page);
  } catch {
    console.warn("Optional Vercel analytics are unavailable.");
  }
  const key = clientEnv.NEXT_PUBLIC_POSTHOG_KEY;
  const endpoint = posthogCaptureUrl(
    clientEnv.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
  );
  if (
    !key ||
    !endpoint ||
    !isPermitted() ||
    analyticsPage(window.location.pathname, window.location.hostname) !== page
  )
    return;
  runtime.controller ??= new AbortController();
  runtime.distinctId ??= crypto.randomUUID();
  const signal = runtime.controller.signal;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal,
      body: JSON.stringify({
        api_key: key,
        event: "$pageview",
        properties: {
          distinct_id: runtime.distinctId,
          $process_person_profile: false,
          $current_url: window.location.origin + page,
          ...analyticsProperties(page, locale),
        },
      }),
    });
    if (!response.ok)
      console.warn("Optional PostHog analytics are unavailable.");
  } catch {
    if (!signal.aborted)
      console.warn("Optional PostHog analytics are unavailable.");
  }
}
