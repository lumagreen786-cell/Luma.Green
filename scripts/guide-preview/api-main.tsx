import { NextIntlClientProvider } from "next-intl";
import { createRoot } from "react-dom/client";

import { AppShell } from "@/components/app/app-shell";
import {
  type AccessData,
  ApiAccess,
} from "@/components/integrations/api-access";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { isLocale, localeMeta } from "@/i18n/locales";

import type { Id } from "../../convex/_generated/dataModel";
import type english from "../../messages/en.json";
import { fixtureFontClasses } from "./appearance";
import { NOW } from "./fixtures";

const segment = window.location.pathname.split("/", 2)[1] ?? "en";
const locale = isLocale(segment) ? segment : "en";
const catalogues = import.meta.glob("../../messages/*.json");
const loadMessages = catalogues[`../../messages/${locale}.json`];
if (!Object.hasOwn(catalogues, `../../messages/${locale}.json`))
  throw new Error("Missing API documentation catalogue.");
// Locale parity tests validate these dynamically loaded catalogue modules.
const { default: messages } = (await loadMessages()) as {
  default: typeof english;
};
document.documentElement.lang = locale;
document.documentElement.dir = localeMeta[locale].dir;
const fontClasses = JSON.parse(
  document.documentElement.dataset.localeFonts ?? "{}",
) as Partial<Record<string, string>>;
const localeFonts = fontClasses[locale];
if (!localeFonts) throw new Error(`Build the ${locale} locale before capture.`);
document.documentElement.className = fixtureFontClasses(
  localeFonts,
  document.documentElement.classList.contains("dark"),
);

const sample: AccessData = {
  canManage: true,
  keys: [
    {
      id: "guide-api-key" as Id<"integrationKeys">,
      label: "Demo factory ERP",
      prefix: "lg_live_demo0000",
      scopes: [
        "organization:read",
        "materials:read",
        "inventory:read",
        "trades:read",
      ],
      createdAt: NOW - 86_400_000,
      expiresAt: NOW + 30 * 86_400_000,
      lastUsedAt: NOW - 3_600_000,
      revokedAt: undefined,
    },
  ],
};
function rejectWrite(): Promise<never> {
  return Promise.reject(
    new Error("Documentation fixture: writes are disabled."),
  );
}
const root = document.querySelector("#root");
if (!root) throw new Error("Documentation preview root is missing.");
createRoot(root).render(
  <NextIntlClientProvider
    locale={locale}
    messages={messages}
    timeZone="Asia/Kolkata"
    now={new Date(NOW)}
  >
    <ThemeProvider>
      <div
        role="note"
        aria-label="Screenshot provenance"
        dir="ltr"
        style={{
          padding: "12px 20px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#fff4ce",
          color: "#4b3900",
          borderBottom: "2px solid #c28d00",
          font: "600 14px/1.5 system-ui",
        }}
      >
        SYNTHETIC DOCUMENTATION FIXTURE — actual Luma.Green components; no live
        account or records. All writes disabled.
      </div>
      <AppShell>
        <ApiAccess
          data={sample}
          onCreate={rejectWrite}
          onRevoke={rejectWrite}
        />
      </AppShell>
    </ThemeProvider>
  </NextIntlClientProvider>,
);
