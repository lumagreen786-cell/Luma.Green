import { defaultLocale, type Locale, locales } from "@/i18n/locales";

import { clientEnv } from "./env";

export const publicOrigin = "https://luma.green";
export const businessOrigin = "https://business.luma.green";

const publicHosts = new Set(["luma.green", "www.luma.green"]);
const businessPaths = new Set([
  "business",
  "participants",
  "how-it-works",
  "standards",
  "prices",
  "join",
]);

function routeParts(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  const hasLocale = (locales as readonly string[]).includes(first);
  return {
    locale: (hasLocale ? first : defaultLocale) as Locale,
    path: `/${(hasLocale ? parts.slice(1) : parts).join("/")}`,
    prefix: hasLocale ? `/${first}` : "",
  };
}

/** Fixed first-party targets only. Never use a forwarded host to form a link. */
export function businessHref(
  path = "/",
  locale: Locale = defaultLocale,
  isEnabled = clientEnv.NEXT_PUBLIC_BUSINESS_SITE_ENABLED,
): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Business links require a local absolute path.");
  }
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  const destination = path === "/business" ? "/" : path;
  if (isEnabled) return `${businessOrigin}${prefix}${destination}`;
  return `${prefix}${destination === "/" ? "/business" : destination}`;
}

export type SiteDomainRoute =
  | { kind: "continue" }
  | { kind: "redirect"; url: string }
  | { kind: "business-home"; locale: Locale };

/** Routing chooses a surface; backend authorization still owns all record access. */
export function siteDomainRoute(
  url: URL,
  isEnabled = clientEnv.NEXT_PUBLIC_BUSINESS_SITE_ENABLED,
): SiteDomainRoute {
  if (!isEnabled) return { kind: "continue" };
  const { locale, path, prefix } = routeParts(url.pathname);
  if (url.hostname === "business.luma.green") {
    if (path === "/") return { kind: "business-home", locale };
    if (path === "/business") {
      const destination = new URL(businessOrigin);
      destination.pathname = `${prefix}/`;
      destination.search = url.search;
      return { kind: "redirect", url: destination.href };
    }
  }
  if (!publicHosts.has(url.hostname)) return { kind: "continue" };
  const first = path.split("/", 2)[1];
  // Existing email links can carry one-time tokens and host-bound sessions.
  // Leave them on their original host until consumed; later navigation can move.
  if (path.startsWith("/login/email/")) return { kind: "continue" };
  if (!businessPaths.has(first) || (first === "join" && path !== "/join"))
    return { kind: "continue" };
  const destination = new URL(businessOrigin);
  destination.pathname = path === "/business" ? `${prefix}/` : url.pathname;
  destination.search = url.search;
  return { kind: "redirect", url: destination.href };
}

/** Public marketing routes may move before existing authenticated sessions do. */
export function isBusinessMarketingPath(path: string): boolean {
  const first = path.split("/", 2)[1];
  return businessPaths.has(first) && (first !== "join" || path === "/join");
}

/** Map an already-localized marketing URL without consulting request headers. */
export function businessCanonicalUrl(
  path: string,
  localizedRoute: string,
): string {
  const destination =
    path === "/business"
      ? `${localizedRoute.slice(0, -path.length)}/`
      : localizedRoute;
  return `${businessOrigin}${destination}`;
}
