import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";
import { siteDomainRoute } from "@/lib/site-domains";

const localeMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const route = siteDomainRoute(new URL(request.url));
  if (route.kind === "redirect") {
    // Temporary while the host split is reversible; do not permanently cache it.
    return NextResponse.redirect(route.url, 307);
  }
  const response = localeMiddleware(request);
  if (route.kind === "business-home" && !response.headers.has("location")) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/${route.locale}/business`;
    response.headers.set("x-middleware-rewrite", destination.toString());
  }
  return response;
}

export const config = {
  // Run on everything except API routes, the admin console (English only,
  // outside the locale segment — docs ADR 0003), Next internals, and files
  // with an extension (images, fonts, robots.txt, …).
  //
  // This MUST stay a plain string literal. Next statically analyses this
  // export at build time and rejects anything it cannot read directly —
  // a `String.raw` template here fails the build with "Invalid segment
  // configuration export".
  // eslint-disable-next-line unicorn/prefer-string-raw
  matcher: "/((?!api|admin|_next|_vercel|monitoring|.*\\..*).*)",
};
