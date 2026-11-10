import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import AccountLayout from "@/app/[locale]/(account)/account/layout";
import HouseholdLayout from "@/app/[locale]/(household)/layout";
import JoinLayout from "@/app/[locale]/(join)/layout";
import FootprintPage from "@/app/[locale]/(site)/sell/footprint/page";
import HouseholdServicesPage from "@/app/[locale]/(site)/sell/services/page";
import HouseholdSettingsPage from "@/app/[locale]/(site)/sell/settings/page";
import { AccountRemoval } from "@/components/account/account-removal";
import { AccountSecurity } from "@/components/account/account-security";
import { PrivacyRequests } from "@/components/account/privacy-requests";
import { AccountRemovals } from "@/components/admin/account-removals";
import { ConsoleHome } from "@/components/admin/console-home";
import { ConsoleShell } from "@/components/admin/console-shell";
import { DraftBillingSetup } from "@/components/admin/draft-billing-setup";
import { OperationsConsole } from "@/components/admin/operations/operations-console";
import { PaymentSetup } from "@/components/admin/payment-setup";
import { PilotNumbers } from "@/components/admin/pilot/pilot-numbers";
import { PriceTables } from "@/components/admin/prices/price-tables";
import { SupportInbox } from "@/components/admin/support/support-inbox";
import { ApplicationReview } from "@/components/admin/verification/application-review";
import { VerificationWorkspace } from "@/components/admin/verification/verification-workspace";
import { AppShell } from "@/components/app/app-shell";
import { RoleHome } from "@/components/app/role-home";
import { FactorChallenge } from "@/components/auth/factor-challenge";
import { BillingPage } from "@/components/billing/billing-page";
import { CarbonProjectsPage } from "@/components/carbon/carbon-projects-page";
import { EvidencePage } from "@/components/evidence/evidence-page";
import { FacilityPage } from "@/components/facility/facility-page";
import { CompliancePage } from "@/components/insights/compliance-page";
import { ImpactPage } from "@/components/insights/impact-page";
import { IntegrationsPage } from "@/components/integrations/integrations-page";
import {
  BusinessJoin,
  DocumentsJoin,
  KabadiwalaJoin,
  SaathiJoin,
} from "@/components/join/join-pages";
import { ParticipantDirectory } from "@/components/join/participant-directory";
import { ParticipantPhoneGate } from "@/components/join/participant-phone-gate";
import { StakeholderRequest } from "@/components/join/stakeholder-request";
import { StatusView } from "@/components/join/status-view";
import { LogisticsPage } from "@/components/logistics/logistics-page";
import { LotDetailPage, LotsPage } from "@/components/lots/lots-page";
import { FinancialLifecycle } from "@/components/market/financial-lifecycle";
import { InvoicePage } from "@/components/market/invoice-page";
import { MarketPage } from "@/components/market/market-page";
import { SellPage } from "@/components/market/sell-page";
import { TradesPage } from "@/components/market/trades-page";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { MaterialStandards } from "@/components/operations/material-standards";
import { ProductionPage } from "@/components/operations/production-page";
import { ReturnClaimsPage } from "@/components/operations/return-claims-page";
import { PaperPage } from "@/components/papers/paper-page";
import { AuditReports } from "@/components/quality/audit-reports";
import { QualityDocuments } from "@/components/quality/quality-documents";
import { SellFlow } from "@/components/sell/sell-flow";
import { ServicesPage } from "@/components/services/services-page";
import { RateCardPage } from "@/components/shop/rate-card-page";
import { RequestDetail } from "@/components/shop/request-detail";
import { RequestsPage } from "@/components/shop/requests-page";
import { StockIntake } from "@/components/shop/stock-intake";
import { StockPage } from "@/components/shop/stock-page";
import { SourcingPage } from "@/components/sourcing/sourcing-page";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TrackView } from "@/components/track/track-view";
import { InvitationPage } from "@/components/workspace/invitation-page";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { localeMeta } from "@/i18n/locales";

import type { Id } from "../../convex/_generated/dataModel";
import { NOW, trackedBooking } from "./fixtures";
import { receiptExample } from "./foundation-fixtures";
import { HouseholdActivityFixture } from "./household-pages";
import { locale, messages } from "./locale";
import { SellSelectionFixture } from "./selection-fixtures";
import { AuthFixtureLayout, SiteFixtureLayout } from "./site-layout";

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
  "/admin/payments": (
    <>
      <PaymentSetup />
      <DraftBillingSetup />
    </>
  ),
  "/admin/account-removals": <AccountRemovals />,
  "/admin/operations": <OperationsConsole />,
  "/admin/support": <SupportInbox />,
  "/admin/verification/guide-shop": (
    <ApplicationReview applicationId="guide-shop" />
  ),
  "/admin/verification": <VerificationWorkspace />,
  "/admin/prices": <PriceTables />,
  "/admin/pilot": <PilotNumbers />,
};
const adminPage = adminPages[path];
// Legacy password routes redirect to admin/login; they have no page to capture.
const recoveryPages: Record<string, ReactNode | undefined> = {};
const recoveryPage = recoveryPages[path];
const defaultAppPage = path.includes("/requests/") ? (
  <RequestDetail id="guide-booking" />
) : (
  <RoleHome />
);
const isRecycledPet =
  new URLSearchParams(window.location.search).get("procurement") === "pet";
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
  "/en/app/integrations": <IntegrationsPage />,
  "/en/app/material-standards": <MaterialStandards />,
  "/en/app/production": <ProductionPage />,
  "/en/app/papers": <PaperPage />,
  "/en/app/sourcing": <SourcingPage />,
  "/en/app/billing": <BillingPage />,
  "/en/app/evidence": <EvidencePage />,
  "/en/app/facility": <FacilityPage />,
  "/en/app/lots": <LotsPage />,
  "/en/app/lots/guide-operations-lot": (
    <LotDetailPage lotId={"guide-operations-lot" as Id<"materialLots">} />
  ),
  "/en/app/logistics": <LogisticsPage />,
  "/en/app/quality-documents": <QualityDocuments />,
  "/en/app/prices": <RateCardPage />,
  "/en/app/stock": <StockPage />,
  "/en/app/sell": <SellPage />,
  "/en/app/impact": <ImpactPage />,
  "/en/app/trades/guide-receipt/invoice": <InvoicePage id="guide-receipt" />,
  "/en/app/requests": <RequestsPage />,
  "/en/app/market": <MarketPage isRecycledPet={isRecycledPet} />,
  "/en/app/trades": <TradesPage isRecycledPet={isRecycledPet} />,
  "/en/app/carbon-projects": <CarbonProjectsPage />,
  "/en/app/compliance": <CompliancePage />,
  "/en/app/services": <ServicesPage />,
  "/en/app/returns": <ReturnClaimsPage />,
  "/en/app/intake-example": <StockIntake />,
};
const appPage = operationalPages[path] ?? defaultAppPage;
const trackingPage = path.startsWith("/en/t/")
  ? await HouseholdLayout({
      children: (
        <TrackView
          booking={
            new URLSearchParams(window.location.search).has("receipt")
              ? receiptExample
              : trackedBooking
          }
        />
      ),
    })
  : null;
const sellPage =
  path === "/en/sell"
    ? await HouseholdLayout({ children: <SellFlow /> })
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
  "/en/join/saathi": <SaathiJoin />,
  "/en/join/recycler": <BusinessJoin kind="recycler" />,
  "/en/join/manufacturer": <BusinessJoin kind="manufacturer" />,
  "/en/join/yard/documents": <DocumentsJoin kind="yard" />,
  "/en/join/roles": (
    <ParticipantPhoneGate>
      <ParticipantDirectory />
    </ParticipantPhoneGate>
  ),
  "/en/join/stakeholder": <StakeholderRequest />,
};
const onboardingContent = onboardingPages[path];
const onboardingPage = onboardingContent
  ? await JoinLayout({ children: onboardingContent })
  : null;
const accountPages: Record<string, ReactNode | undefined> = {
  "/en/account/privacy": <PrivacyRequests />,
  "/en/account/workspaces/invite": (
    <InvitationPage token="guide-synthetic-invitation" />
  ),
  "/en/account/reports": <AuditReports />,
  "/en/account/workspaces": <WorkspacePage />,
  "/en/account/notifications": <NotificationsPage />,
  "/en/account/security": <AccountSecurity />,
  "/en/account/removal": <AccountRemoval />,
  "/en/account/services": <ServicesPage />,
};
const accountContent = accountPages[path];
const accountPage = accountContent
  ? await AccountLayout({ children: accountContent })
  : null;
const householdPages: Record<string, ReactNode | undefined> = {
  "/en/sell/activity": <HouseholdActivityFixture />,
  "/en/sell/services":
    path === "/en/sell/services" ? await HouseholdServicesPage() : undefined,
  "/en/sell/footprint":
    path === "/en/sell/footprint" ? await FootprintPage() : undefined,
  "/en/sell/settings":
    path === "/en/sell/settings" ? await HouseholdSettingsPage() : undefined,
};
const householdContent = householdPages[path];
const householdPage = householdContent
  ? await SiteFixtureLayout({ children: householdContent })
  : null;
const challengePage =
  path === "/en/login/factor"
    ? await AuthFixtureLayout({
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
const isMappedRoute =
  path === "/en/app" ||
  path === "/en/app/requests/guide-booking" ||
  Object.hasOwn(operationalPages, path) ||
  [
    adminPage,
    recoveryPage,
    accountPage,
    householdPage,
    challengePage,
    trackingPage,
    sellPage,
    sellSelectionPage,
    onboardingPage,
  ].some(Boolean);
if (!isMappedRoute) throw new Error(`Unmapped isolated preview route: ${path}`);
document.documentElement.dataset.previewRoute = path;
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
        Example screen — made-up data. Actual Luma.Green components; no live
        account or records. All writes disabled.
      </div>
      {householdPage ??
        recoveryPage ??
        accountPage ??
        challengePage ??
        trackingPage ??
        sellPage ??
        sellSelectionPage ??
        onboardingPage ??
        content}
    </ThemeProvider>
  </NextIntlClientProvider>,
);
