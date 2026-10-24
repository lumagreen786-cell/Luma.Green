import { NextIntlClientProvider } from "next-intl";
import { createRoot } from "react-dom/client";

import { BusinessForm } from "@/components/join/business-form";
import { KabadiwalaForm } from "@/components/join/kabadiwala-form";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { localeMeta } from "@/i18n/locales";

import { onboardingFixture } from "./fixtures";
import { locale, messages } from "./locale";

const application = onboardingFixture()?.application;
if (!application) throw new Error("Synthetic application fixture missing");
document.documentElement.lang = locale;
document.documentElement.dir = localeMeta[locale].dir;
const fonts = JSON.parse(
  document.documentElement.dataset.localeFonts ?? "{}",
) as Record<string, string>;
document.documentElement.className = fonts[locale] ?? "";
const root = document.querySelector("#root");
if (!root) throw new Error("Fixture root missing");
createRoot(root).render(
  <NextIntlClientProvider locale={locale} messages={messages}>
    <ThemeProvider>
      <p className="p-3 text-sm">
        Synthetic interface fixture. No login, paid request or provider
        verification.
      </p>
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        {application.kind === "yard" ? (
          <BusinessForm
            kind="yard"
            application={application}
            loginPhone={undefined}
          />
        ) : (
          <KabadiwalaForm application={application} loginPhone={undefined} />
        )}
      </main>
    </ThemeProvider>
  </NextIntlClientProvider>,
);
