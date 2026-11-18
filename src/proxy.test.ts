// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  clientEnv: { NEXT_PUBLIC_BUSINESS_SITE_ENABLED: true },
}));

import proxy from "./proxy";

describe("localized domain proxy", () => {
  it("rewrites the business root to its own English page", () => {
    const response = proxy(
      new NextRequest("https://business.luma.green/?utm_source=ad"),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://business.luma.green/en/business?utm_source=ad",
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("retains next-intl request locale headers for translated business roots", () => {
    const response = proxy(new NextRequest("https://business.luma.green/ta"));
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://business.luma.green/ta/business",
    );
    expect(
      response.headers.get("x-middleware-request-x-next-intl-locale"),
    ).toBe("ta");
  });

  it("preserves the normal public homepage", () => {
    const response = proxy(new NextRequest("https://luma.green/ta"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(
      response.headers.get("x-middleware-request-x-next-intl-locale"),
    ).toBe("ta");
  });

  it("redirects an old business route with a temporary status", () => {
    const response = proxy(
      new NextRequest("https://luma.green/ta/participants?view=new"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://business.luma.green/ta/participants?view=new",
    );
  });
  it("does not treat a spoofed forwarded host as the business domain", () => {
    const response = proxy(
      new NextRequest("https://unrelated.example/", {
        headers: { "x-forwarded-host": "business.luma.green" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://unrelated.example/en",
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("canonicalizes the business page alias before its root rewrite", () => {
    const alias = proxy(
      new NextRequest("https://business.luma.green/ta/business?campaign=one"),
    );
    expect(alias.headers.get("location")).toBe(
      "https://business.luma.green/ta/?campaign=one",
    );
    const canonical = proxy(
      new NextRequest("https://business.luma.green/ta?campaign=one"),
    );
    expect(canonical.headers.get("location")).toBeNull();
    expect(canonical.headers.get("x-middleware-rewrite")).toBe(
      "https://business.luma.green/ta/business?campaign=one",
    );
  });
});
