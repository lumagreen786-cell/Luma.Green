import { expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/require-session", () => ({ requireSession }));
vi.mock("@/components/account/account-removal", () => ({
  AccountRemoval: () => null,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));
import Page, { generateMetadata } from "./page";

it("guards removal with the account session and preserves its destination", async () => {
  await Page({ params: Promise.resolve({ locale: "ar" }) });
  expect(requireSession).toHaveBeenCalledWith("ar", "/account/removal");
  const metadata = await generateMetadata({
    params: Promise.resolve({ locale: "ar" }),
  });
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.referrer).toBe("no-referrer");
  expect(metadata.alternates).toEqual({});
});
