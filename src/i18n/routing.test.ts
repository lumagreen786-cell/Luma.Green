// @vitest-environment node
import { createJiti } from "jiti";
import { NextRequest } from "next/server";
import type createIntlMiddleware from "next-intl/middleware";
import { describe, expect, it } from "vitest";

import { routing } from "./routing";

// next-intl's middleware imports extensionless Next modules. Jiti applies the
// same extension resolution as Next instead of Node's strict ESM resolver.
const jiti = createJiti(import.meta.url);
const { default: createMiddleware } = await jiti.import<{
  default: typeof createIntlMiddleware;
}>("next-intl/middleware");
const resolve = createMiddleware(routing);

describe("tab-owned language routes", () => {
  it.each(["/", "/help", "/login?next=%2Fapp"])(
    "keeps English %s when another tab last chose Portuguese",
    (path) => {
      const response = resolve(
        new NextRequest(`https://luma.example${path}`, {
          headers: {
            Cookie: "NEXT_LOCALE=pt",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          },
        }),
      );
      expect(response.headers.get("location")).toBeNull();
      const rewrite = response.headers.get("x-middleware-rewrite");
      expect(rewrite).not.toBeNull();
      expect(new URL(rewrite ?? "").pathname).toBe(
        path === "/" ? "/en" : `/en${path.split("?", 1)[0]}`,
      );
      expect(response.cookies.get("NEXT_LOCALE")).toBeUndefined();
    },
  );

  it("keeps Portuguese routes when another tab last chose English", () => {
    const response = resolve(
      new NextRequest("https://luma.example/pt/help", {
        headers: { Cookie: "NEXT_LOCALE=en", "Accept-Language": "en" },
      }),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(
      response.headers.get("x-middleware-request-x-next-intl-locale"),
    ).toBe("pt");
    expect(response.cookies.get("NEXT_LOCALE")).toBeUndefined();
  });
});
