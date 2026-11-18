import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  clientEnv: { NEXT_PUBLIC_BUSINESS_SITE_ENABLED: true },
}));

import sitemap from "@/app/sitemap";

import { pageMetadata } from "./seo";

const input = { title: "Business", description: "The recycling ecosystem." };

describe("enabled business host metadata", () => {
  it("uses the business root as canonical and language alternates", () => {
    const metadata = pageMetadata({
      ...input,
      locale: "ta",
      path: "/business",
    });
    expect(metadata.alternates?.canonical).toBe(
      "https://business.luma.green/ta/",
    );
    expect(metadata.alternates?.languages?.["x-default"]).toBe(
      "https://business.luma.green/",
    );
    expect(metadata.alternates?.languages?.ar).toBe(
      "https://business.luma.green/ar/",
    );
    expect(metadata.openGraph?.url).toBe("https://business.luma.green/ta/");
  });
  it("moves other business marketing metadata but keeps household metadata local", () => {
    expect(
      pageMetadata({ ...input, locale: "en", path: "/participants" }).alternates
        ?.canonical,
    ).toBe("https://business.luma.green/participants");
    expect(
      pageMetadata({ ...input, locale: "ta", path: "/" }).alternates?.canonical,
    ).toBe("/ta");
  });
  it("publishes only canonical business URLs in the shared sitemap", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://business.luma.green/");
    expect(urls).toContain("https://business.luma.green/ta/");
    expect(urls).toContain("https://business.luma.green/participants");
    expect(urls).toContain("https://luma.green/ta");
    expect(urls).not.toContain("https://luma.green/business");
    expect(urls).not.toContain("https://luma.green/participants");
    expect(
      entries.find((entry) => entry.url === "https://business.luma.green/")
        ?.alternates?.languages?.["x-default"],
    ).toBe("https://business.luma.green/");
  });
});
