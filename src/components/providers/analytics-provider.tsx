"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { clientEnv } from "@/lib/env";

const AnalyticsControls = dynamic(
  async () => {
    const module_ = await import("./analytics-controls");
    return module_.AnalyticsControls;
  },
  { ssr: false },
);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const isConfigured =
    clientEnv.NEXT_PUBLIC_TELEMETRY_ENABLED &&
    (Boolean(clientEnv.NEXT_PUBLIC_POSTHOG_KEY) ||
      clientEnv.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED);
  return (
    <>
      {children}
      {isConfigured ? <AnalyticsControls /> : null}
    </>
  );
}
