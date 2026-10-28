import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "./auth";
import { serve as serveCashfree } from "./cashfreeHttp";
import { FILES_PATH, preflight, serve } from "./files";
import { serve as serveIntegration } from "./integrationHttp";
import { INTEGRATION_PATH } from "./lib/integrationHttp";
import {
  preflight as paperPreflight,
  serve as servePaper,
} from "./paperDrafts";
import {
  preflight as qualityPreflight,
  serve as serveQuality,
} from "./qualityFiles";

const http = httpRouter();
http.route({ pathPrefix: "/paper-files/", method: "GET", handler: servePaper });
http.route({
  pathPrefix: "/paper-files/",
  method: "OPTIONS",
  handler: paperPreflight,
});
http.route({
  pathPrefix: "/quality-files/",
  method: "GET",
  handler: serveQuality,
});
http.route({
  pathPrefix: "/quality-files/",
  method: "OPTIONS",
  handler: qualityPreflight,
});

// Better Auth's endpoints; Next.js proxies /api/auth/* here.
authComponent.registerRoutes(http, createAuth);

// Private files, checked on every request (convex/files.ts).
http.route({ pathPrefix: FILES_PATH, method: "GET", handler: serve });
http.route({ pathPrefix: FILES_PATH, method: "OPTIONS", handler: preflight });

// REST v1 uses scoped machine credentials, independent of browser sessions.
for (const method of [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const) {
  http.route({
    pathPrefix: INTEGRATION_PATH,
    method,
    handler: serveIntegration,
  });
}

for (const mode of ["sandbox", "live"] as const) {
  http.route({
    path: `/payments/cashfree/${mode}`,
    method: "POST",
    handler: serveCashfree,
  });
}

export default http;
