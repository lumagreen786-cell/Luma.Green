import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import messages from "../../../messages/en.json";
import type { ListingView, TradeView } from "./types";

/** English test labels with the active locale's number rules and India time. */
export function WithIntl({
  children,
  locale = "en",
}: {
  children: ReactNode;
  locale?: string;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Kolkata"
    >
      {children}
    </NextIntlClientProvider>
  );
}

export function aTrade(overrides: Partial<TradeView> = {}): TradeView {
  return {
    specification: undefined,
    id: "trade1" as TradeView["id"],
    material: {
      code: "PAPER-NEWS",
      names: { en: "Newspaper" },
      family: "paper",
    },
    grams: 100_000,
    paisePerKg: 1750,
    totalPaise: 175_000,
    status: "requested",
    timeline: [{ status: "requested", at: Date.parse("2026-10-02T10:00:00Z") }],
    counterparty: {
      name: "Peenya Paper & Plastic Yard",
      area: "Peenya Industrial Area",
      kind: "yard",
    },
    invoiceNo: undefined,
    legacyReceiptNo: undefined,
    paymentVerification: "not_applicable",
    needsEwayBill: false,
    inEscrow: false,
    actions: [],
    createdAt: Date.parse("2026-10-02T10:00:00Z"),
    ...overrides,
  };
}

export function aListing(overrides: Partial<ListingView> = {}): ListingView {
  return {
    specification: undefined,
    id: "listing1" as ListingView["id"],
    seller: {
      name: "Ramesh Kabadi Store",
      area: "Yeshwanthpur",
      kind: "kabadiwala",
    },
    material: {
      code: "PAPER-NEWS",
      names: { en: "Newspaper" },
      family: "paper",
    },
    grams: 150_000,
    askPaisePerKg: 1750,
    note: "Dry, bundled",
    status: "open",
    isMine: false,
    origin: undefined,
    createdAt: Date.parse("2026-10-01T10:00:00Z"),
    expiresAt: Date.now() + 86_400_000,
    ...overrides,
  };
}
