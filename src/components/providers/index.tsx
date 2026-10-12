import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import { NotificationDeviceProvider } from "@/components/notifications/device-provider";
import {
  LocalizedThemeToaster,
  ThemeProvider,
} from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AnalyticsProvider } from "./analytics-provider";
import { ConvexClientProvider } from "./convex-provider";

/**
 * The single provider stack for the app. Order matters:
 * intl → convex → optional analytics → UI primitives.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider>
      <ThemeProvider>
        <ConvexClientProvider>
          <AnalyticsProvider>
            <NotificationDeviceProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </NotificationDeviceProvider>
            <LocalizedThemeToaster />
          </AnalyticsProvider>
        </ConvexClientProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
