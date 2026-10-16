import type { AnchorHTMLAttributes } from "react";

import { isLocale } from "@/i18n/locales";

type Destination =
  string | { pathname: string; query?: Record<string, string> };
function hrefOf(value: Destination) {
  if (typeof value === "string") return value;
  const query = value.query
    ? `?${new URLSearchParams(value.query).toString()}`
    : "";
  return `${value.pathname}${query}`;
}
export function Link({
  href,
  children,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Destination;
}) {
  return (
    <a href={hrefOf(href)} {...props}>
      {children}
    </a>
  );
}
const router = {
  push: (href: Destination) => {
    window.location.assign(hrefOf(href));
  },
  replace: (href: Destination) => {
    window.location.replace(hrefOf(href));
  },
};
export function useRouter() {
  return router;
}
export function usePathname() {
  const pathname = window.location.pathname;
  const segment = pathname.split("/", 3)[1] ?? "";
  return (
    (isLocale(segment) ? pathname.slice(segment.length + 1) : pathname) || "/"
  );
}
export function useSearchParams() {
  return new URLSearchParams(window.location.search);
}
/** Server redirects must never simulate successful access in a fixture. */
export function redirect(): never {
  throw new Error("Server redirects are unavailable in the isolated preview.");
}
export default Link;
