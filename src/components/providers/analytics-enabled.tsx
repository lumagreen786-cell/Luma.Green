"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

import { usePathname } from "@/i18n/navigation";
import { analyticsPage } from "@/lib/analytics";
import {
  recordPageView,
  resumeAnalytics,
  stopAnalytics,
} from "@/lib/analytics-runtime";

export function AnalyticsEnabled() {
  const pathname = usePathname();
  const locale = useLocale();
  const lastPage = useRef<string | null>(null);
  useEffect(() => {
    resumeAnalytics();
    const page = analyticsPage(pathname, window.location.hostname);
    if (page === undefined) {
      lastPage.current = null;
      stopAnalytics();
    } else if (lastPage.current !== `${locale}:${page}`) {
      lastPage.current = `${locale}:${page}`;
      void recordPageView(page, locale).catch(() => {
        console.warn("Optional analytics are unavailable.");
      });
    }
    return stopAnalytics;
  }, [pathname, locale]);
  return null;
}
