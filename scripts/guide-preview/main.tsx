import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import AccountLayout from "@/app/[locale]/(account)/account/layout";
import AuthLayout from "@/app/[locale]/(auth)/layout";
import HouseholdLayout from "@/app/[locale]/(household)/layout";
import JoinLayout from "@/app/[locale]/(join)/layout";
import ForgotPasswordPage from "@/app/admin/forgot-password/page";
import ResetPasswordPage from "@/app/admin/reset-password/page";
import { AccountSecurity } from "@/components/account/account-security";
import { ConsoleHome } from "@/components/admin/console-home";
import { ConsoleShell } from "@/components/admin/console-shell";
import { PilotNumbers } from "@/components/admin/pilot/pilot-numbers";
import { PriceTables } from "@/components/admin/prices/price-tables";
import { SupportInbox } from "@/components/admin/support/support-inbox";
import { ApplicationReview } from "@/components/admin/verification/application-review";
import { VerificationQueue } from "@/components/admin/verification/queue";
import { AppShell } from "@/components/app/app-shell";
import { RoleHome } from "@/components/app/role-home";
import { FactorChallenge } from "@/components/auth/factor-challenge";
import { CompliancePage } from "@/components/insights/compliance-page";
import { ImpactPage } from "@/components/insights/impact-page";
import { BusinessJoin, KabadiwalaJoin } from "@/components/join/join-pages";
import { StatusView } from "@/components/join/status-view";
import { FinancialLifecycle } from "@/components/market/financial-lifecycle";
import { InvoicePage } from "@/components/market/invoice-page";
import { MarketPage } from "@/components/market/market-page";
import { SellPage } from "@/components/market/sell-page";
import { TradesPage } from "@/components/market/trades-page";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { RateCardPage } from "@/components/shop/rate-card-page";
import { RequestDetail } from "@/components/shop/request-detail";
import { RequestsPage } from "@/components/shop/requests-page";
import { StockPage } from "@/components/shop/stock-page";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TrackView } from "@/components/track/track-view";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { localeMeta } from "@/i18n/locales";

import type { Id } from "../../convex/_generated/dataModel";
import { NOW, trackedBooking } from "./fixtures";
import { locale, messages } from "./locale";
import { SellSelectionFixture } from "./selection-fixtures";

const path = window.location.pathname.replace(`/${locale}/`, "/en/");
document.documentElement.lang = locale;
document.documentElement.dir = localeMeta[locale].dir;
const fontClasses = JSON.parse(
  document.documentElement.dataset.localeFonts ?? "{}",
) as Partial<Record<string, string>>;
const localeFonts = fontClasses[locale];
if (!localeFonts) throw new Error(`Build the ${locale} locale before capture.`);
document.documentElement.className = localeFonts;
const adminPages: Record<string, ReactNode | undefined> = {
  "/admin": <ConsoleHome />,
  "/admin/support": <SupportInbox />,
  "/admin/verification/guide-shop": (
    <ApplicationReview applicationId="guide-shop" />
  ),
  "/admin/verification": <VerificationQueue />,
  "/admin/prices": <PriceTables />,
  "/admin/pilot": <PilotNumbers />,
};
const adminPage = adminPages[path];
const recoveryPages: Record<string, ReactNode | undefined> = {
  "/admin/forgot-password": <ForgotPasswordPage />,
  "/admin/reset-password": <ResetPasswordPage />,
};
const recoveryPage = recoveryPages[path];
const defaultAppPage = path.includes("/requests/") ? (
  <RequestDetail id="guide-booking" />
) : (
  <RoleHome />
);
const operationalPages: Record<string, ReactNode | undefined> = {
  "/en/app/finance-example": (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {messages.tradeLifecycle.title}
      </h1>
      <p className="text-sm text-muted-foreground">
        SIMULATED FINANCIAL STATE — interface example only. No actual payment,
        provider evidence, authorization or stock movement. All writes disabled.
      </p>
      <FinancialLifecycle tradeId={"guide-finance-example" as Id<"trades">} />
    </div>
  ),
  "/en/app/prices": <RateCardPage />,
  "/en/app/stock": <StockPage />,
  "/en/app/sell": <SellPage />,
  "/en/app/impact": <ImpactPage />,
  "/en/app/trades/guide-receipt/invoice": <InvoicePage id="guide-receipt" />,
  "/en/app/requests": <RequestsPage />,
  "/en/app/market": <MarketPage />,
  "/en/app/trades": <TradesPage />,
  "/en/app/compliance": <CompliancePage />,
};
const appPage = operationalPages[path] ?? defaultAppPage;
const trackingPage = path.startsWith("/en/t/")
  ? await HouseholdLayout({ children: <TrackView booking={trackedBooking} /> })
  : null;
const sellSelectionPages: Record<string, ReactNode | undefined> = {
  "/en/sell/basket": <SellSelectionFixture step="basket" />,
  "/en/sell/shop": <SellSelectionFixture step="shop" />,
  "/en/sell/when": <SellSelectionFixture step="when" />,
};
const sellSelectionContent = sellSelectionPages[path];
const sellSelectionPage = sellSelectionContent
  ? await HouseholdLayout({ children: sellSelectionContent })
  : null;
const onboardingPages: Record<string, ReactNode | undefined> = {
  "/en/join/kabadiwala": <KabadiwalaJoin />,
  "/en/join/yard": <BusinessJoin kind="yard" />,
  "/en/join/status": <StatusView />,
};
const onboardingContent = onboardingPages[path];
const onboardingPage = onboardingContent
  ? await JoinLayout({ children: onboardingContent })
  : null;
const accountPages: Record<string, ReactNode | undefined> = {
  "/en/account/workspaces": <WorkspacePage />,
  "/en/account/notifications": <NotificationsPage />,
  "/en/account/security": <AccountSecurity />,
};
const accountContent = accountPages[path];
const accountPage = accountContent
  ? await AccountLayout({ children: accountContent })
  : null;
const challengePage =
  path === "/en/login/factor"
    ? await AuthLayout({
        children: (
          <FactorChallenge
            onVerified={() => {
              throw new Error("Documentation fixtures cannot authenticate.");
            }}
            onRestart={() => {
              window.location.reload();
            }}
          />
        ),
      })
    : null;
const content = adminPage ? (
  <ConsoleShell>{adminPage}</ConsoleShell>
) : (
  <AppShell>{appPage}</AppShell>
);
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
      {recoveryPage ??
        accountPage ??
        challengePage ??
        trackingPage ??
        sellSelectionPage ??
        onboardingPage ??
        content}
    </ThemeProvider>
  </NextIntlClientProvider>,
);
