import { describe, expect, it, vi } from "vitest";

import { businessHref, siteDomainRoute } from "./site-domains";

vi.mock("./env", () => ({
  clientEnv: { NEXT_PUBLIC_BUSINESS_SITE_ENABLED: false },
}));

describe("business site routing", () => {
  it("leaves the existing site intact until activation", () => {
    expect(siteDomainRoute(new URL("https://luma.green/app"))).toEqual({
      kind: "continue",
    });
    expect(businessHref("/", "en")).toBe("/business");
    expect(businessHref("/login", "ta")).toBe("/ta/login");
  });

  it.each(["participants", "how-it-works", "join", "standards"])(
    "moves %s to the fixed business host and retains locale/query",
    (path) => {
      expect(
        siteDomainRoute(
          new URL(`https://luma.green/ta/${path}?from=campaign`),
          true,
        ),
      ).toEqual({
        kind: "redirect",
        url: `https://business.luma.green/ta/${path}?from=campaign`,
      });
    },
  );

  it("canonicalizes the ecosystem entry to the business root", () => {
    expect(
      siteDomainRoute(
        new URL("https://luma.green/business?utm_source=ad"),
        true,
      ),
    ).toEqual({
      kind: "redirect",
      url: "https://business.luma.green/?utm_source=ad",
    });
    expect(businessHref("/", "ta", true)).toBe(
      "https://business.luma.green/ta/",
    );
    expect(businessHref("/business", "en", true)).toBe(
      "https://business.luma.green/",
    );
  });

  it.each([
    ["", "en"],
    ["/ta", "ta"],
    ["/ar/", "ar"],
  ])("selects the localized business homepage at %s", (path, locale) => {
    expect(
      siteDomainRoute(new URL(`https://business.luma.green${path}`), true),
    ).toEqual({
      kind: "business-home",
      locale,
    });
  });

  it.each([
    "/",
    "/sell",
    "/app/collections",
    "/account/workspaces",
    "/join/kabadiwala",
    "/login",
    "/t/private-token",
    "/privacy",
    "/help",
    "/status",
    "/admin",
    "/api/auth/session",
    "/login/email/complete?token=private",
    "/login/email/reset?token=private",
  ])(
    "does not move existing public, admin, API or email callback route %s",
    (path) => {
      expect(
        siteDomainRoute(new URL(`https://luma.green${path}`), true),
      ).toEqual({ kind: "continue" });
    },
  );

  it.each([
    "localhost:3000",
    "127.0.0.1:3000",
    "evil.example",
    "business.luma.green.evil.example",
    "test.vercel.app",
  ])("does not activate production redirects on %s", (host) => {
    expect(siteDomainRoute(new URL(`http://${host}/app`), true)).toEqual({
      kind: "continue",
    });
  });

  it.each([
    "//evil.example",
    "https://evil.example",
    String.raw`/\evil.example`,
  ])("rejects external destinations %s", (path) => {
    expect(() => businessHref(path, "en", true)).toThrow("local absolute path");
  });

  it("does not redirect business pages back into a loop", () => {
    expect(
      siteDomainRoute(
        new URL("https://business.luma.green/ta/app/collections"),
        true,
      ),
    ).toEqual({ kind: "continue" });
  });
});
