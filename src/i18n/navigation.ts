/**
 * Locale-aware replacements for `next/link` and the `next/navigation` hooks.
 * Always import navigation helpers from here — never from `next/navigation`
 * directly — or links will drop the active locale.
 */
export { getPathname, Link, redirect, usePathname } from "./navigation-shared";
export { useRouter } from "./router";
