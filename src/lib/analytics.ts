import { locales } from "@/i18n/locales";

export const analyticsChoiceKey = "luma.analytics.v1";
export type AnalyticsChoice = "granted" | "denied";
const session = { blocked: false };

// Explicit marketing-only allowlist: new routes do not silently gain tracking.
const supportedLocales: ReadonlySet<string> = new Set(locales);
const measuredPages = new Set([
  "/",
  "/business",
  "/business/collectors",
  "/how-it-works",
  "/participants",
  "/prices",
  "/standards",
  "/solar",
  "/help",
]);

export function analyticsPage(
  pathname: string,
  hostname?: string,
): string | undefined {
  const path = pathname.split(/[?#]/, 1)[0] ?? "";
  const parts = path.split("/");
  if (supportedLocales.has(parts[1] ?? "")) parts.splice(1, 1);
  const route = parts.join("/") || "/";
  // The business root is rewritten to /business; report both URLs as one page.
  if (route === "/" && hostname === "business.luma.green") return "/business";
  return measuredPages.has(route) ? route : undefined;
}

export function readAnalyticsChoice(): AnalyticsChoice | null {
  if (session.blocked) return "denied";
  try {
    const value = localStorage.getItem(analyticsChoiceKey);
    if (value === null) return null;
    return value === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

// The return value is write success; the function performs storage I/O.
// eslint-disable-next-line unicorn/consistent-boolean-name
export function saveAnalyticsChoice(choice: AnalyticsChoice): boolean {
  try {
    localStorage.setItem(analyticsChoiceKey, choice);
    session.blocked = false;
    return true;
  } catch {
    session.blocked = true;
    return false;
  }
}

/** No URL/query, page title, DOM text, identity or customer record enters events. */
export function analyticsProperties(page: string, locale: string) {
  return { page, locale };
}
