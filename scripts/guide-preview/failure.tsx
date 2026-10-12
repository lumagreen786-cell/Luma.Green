import { NextIntlClientProvider } from "next-intl";
import { createRoot } from "react-dom/client";

import { AdminLogin } from "@/components/admin/admin-login";
import { AdminSetup } from "@/components/admin/admin-setup";
import { AdminAuthShell } from "@/components/admin/auth-shell";
import { AppShell } from "@/components/app/app-shell";
import { ContactMessageForm } from "@/components/help/contact-form";
import { FileSlot } from "@/components/join/file-slot";
import { StatusView } from "@/components/join/status-view";
import { BuyButton } from "@/components/market/buy-dialog";
import { ListingCard } from "@/components/market/listing-card";
import type { ListingView } from "@/components/market/types";
import {
  LocalizedThemeToaster,
  ThemeProvider,
} from "@/components/theme/theme-provider";
import { WorkspacePermissions } from "@/components/workspace/permissions";

import type { Id } from "../../convex/_generated/dataModel";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const params = new URLSearchParams(window.location.search);
const scenario = params.get("scenario");
const locale = params.get("locale") === "ar" ? "ar" : "en";
document.documentElement.lang = locale;
document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
const fontClasses = JSON.parse(
  document.documentElement.dataset.localeFonts ?? "{}",
) as Partial<Record<string, string>>;
const localeFonts = fontClasses[locale];
if (!localeFonts) throw new Error(`Build the ${locale} locale before capture.`);
document.documentElement.className = localeFonts;
const catalogue = locale === "ar" ? ar : en;
const extremeListing: ListingView = {
  specification: undefined,
  id: "fixture-extreme-listing" as Id<"listings">,
  seller: { name: "Fixture seller", kind: "kabadiwala", area: "Fixture area" },
  material: {
    code: "PAPER-NEWS",
    family: "paper",
    names: { en: "Newspaper", ar: "ورق الصحف" },
  },
  grams: 2000,
  askPaisePerKg: Number.MAX_SAFE_INTEGER,
  note: undefined,
  status: "open",
  isMine: false,
  origin: undefined,
  createdAt: 0,
};
const content = (() => {
  if (scenario === "market")
    return (
      <WorkspacePermissions membershipRole="member">
        <ListingCard
          listing={extremeListing}
          action={<BuyButton listing={extremeListing} />}
        />
      </WorkspacePermissions>
    );
  if (scenario === "login" || scenario === "totp")
    return (
      <AdminAuthShell title="Admin sign-in">
        <AdminLogin />
      </AdminAuthShell>
    );
  if (scenario === "setup")
    return (
      <AdminAuthShell title="Set up the admin account">
        <AdminSetup />
      </AdminAuthShell>
    );
  if (scenario === "signout")
    return (
      <AppShell>
        <h1>{catalogue.app.nav.home}</h1>
      </AppShell>
    );
  if (scenario === "discard") return <StatusView />;
  if (scenario === "support") return <ContactMessageForm />;
  return (
    <FileSlot
      type="id_proof"
      label={catalogue.join.roles.kabadiwala.title}
      hint="SYNTHETIC FILE — no uploaded document"
      files={[
        {
          id: "fixture-file" as Id<"applicationFiles">,
          type: "id_proof",
          name: "example-document.pdf",
          size: 123,
          contentType: "application/pdf",
        },
      ]}
    />
  );
})();
const root = document.querySelector("#root");
if (!root) throw new Error("Failure fixture root is missing.");
createRoot(root).render(
  <NextIntlClientProvider
    locale={locale}
    messages={catalogue}
    timeZone="Asia/Kolkata"
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
        SYNTHETIC FAILURE FIXTURE — actual components; rejected local requests.
        No live account, file or provider. No writes.
      </div>
      {["signout", "login", "setup", "totp"].includes(scenario ?? "") ? (
        content
      ) : (
        <main
          className={`mx-auto flex flex-col gap-5 px-5 py-8 ${scenario === "support" ? "max-w-2xl" : "max-w-md"}`}
        >
          {content}
        </main>
      )}
      <LocalizedThemeToaster />
    </ThemeProvider>
  </NextIntlClientProvider>,
);
