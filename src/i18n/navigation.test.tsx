import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRouter } from "./navigation";

const nextRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  bfcacheId: "current-route",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => nextRouter,
  usePathname: () => "/pt/help",
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

function usePortugueseRouter() {
  return renderHook(useRouter, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="pt" messages={{}}>
        {children}
      </NextIntlClientProvider>
    ),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("canonical locale navigation", () => {
  it.each(["push", "replace", "prefetch"] as const)(
    "%s sends English directly to its unprefixed canonical URL",
    (method) => {
      const { result } = usePortugueseRouter();
      result.current[method]("/help", { locale: "en" });
      expect(nextRouter[method]).toHaveBeenCalledWith("/help");
    },
  );

  it("retains the active non-English language during ordinary navigation", () => {
    const { result } = usePortugueseRouter();
    result.current.push("/help");
    expect(nextRouter.push).toHaveBeenCalledWith("/pt/help");
  });

  it("keeps query, anchor and navigation options during a language change", () => {
    const { result } = usePortugueseRouter();
    result.current.replace("/help?role=yard&next=%2Fapp#contact", {
      locale: "en",
      scroll: false,
      transitionTypes: ["language"],
    });
    expect(nextRouter.replace).toHaveBeenCalledWith(
      "/help?role=yard&next=%2Fapp#contact",
      { scroll: false, transitionTypes: ["language"] },
    );
  });

  it("localizes object paths and preserves prefetch callbacks", () => {
    const { result } = usePortugueseRouter();
    const onInvalidate = vi.fn();
    result.current.prefetch(
      { pathname: "/login", query: { next: "/app", role: "yard" } },
      { locale: "kn", onInvalidate },
    );
    expect(nextRouter.prefetch).toHaveBeenCalledWith(
      "/kn/login?next=%2Fapp&role=yard",
      { kind: "auto", onInvalidate },
    );
  });

  it("preserves history, refresh and route identity APIs", () => {
    const { result } = usePortugueseRouter();
    result.current.back();
    result.current.forward();
    result.current.refresh();
    expect(nextRouter.back).toHaveBeenCalledOnce();
    expect(nextRouter.forward).toHaveBeenCalledOnce();
    expect(nextRouter.refresh).toHaveBeenCalledOnce();
    expect(result.current.bfcacheId).toBe("current-route");
  });
});
