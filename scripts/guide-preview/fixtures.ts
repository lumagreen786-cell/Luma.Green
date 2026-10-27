import type { FunctionReturnType } from "convex/server";

import type { ReviewedApplication } from "@/components/admin/verification/checklist";
import type { ComplianceRecord, OrgImpact } from "@/components/insights/types";
import type { Mine } from "@/components/join/use-mine";
import type {
  SellableItem,
  TradeReceipt,
  TradeView,
} from "@/components/market/types";
import type { Board } from "@/components/saathi/job-meta";
import type {
  BookingDetail,
  BookingView,
  MaterialRef,
  RateCard,
  Requests,
  Stock,
} from "@/components/shop/types";
import type { TrackedBooking } from "@/components/track/types";

import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CATALOGUE } from "../../convex/lib/catalogue";
import { isSpecialistMaterial } from "../../convex/lib/specialistReferences";

export const NOW = Date.parse("2026-10-14T06:00:00Z");
const TODAY = "2026-10-14";
const HOUR = 3_600_000;
function materialRef(code: string): MaterialRef {
  const item = CATALOGUE.find((entry) => entry.code === code);
  if (!item) throw new Error(`Unknown fixture material: ${code}`);
  return { code: item.code, family: item.family, names: item.names };
}
const materials = ["PAPER-NEWS", "PLASTIC-PET", "METAL-IRON"].map((code) =>
  materialRef(code),
);
const paper = materialRef("PAPER-NEWS");
const plastic = materialRef("PLASTIC-PET");
const booking: BookingView = {
  id: "guide-booking" as Id<"bookings">,
  token: "",
  name: "Demo household",
  phone: "+91••••••0000",
  address: "Sample address, Yeshwanthpur, Bengaluru",
  mode: "pickup",
  items: [
    { material: paper, estKg: 12 },
    { material: plastic, estKg: 3 },
  ],
  estimatePaise: 22_800,
  slotDate: TODAY,
  slotWindow: "afternoon",
  status: "accepted",
  receipt: undefined,
  createdAt: NOW - HOUR,
};
const requests: Requests = {
  new: [
    {
      ...booking,
      id: "guide-request-new" as Id<"bookings">,
      status: "requested",
      name: undefined,
      address: "Yeshwanthpur",
    },
  ],
  active: [booking],
  done: [],
};
const detail: BookingDetail = {
  booking,
  timeline: [
    { status: "requested", at: NOW - HOUR },
    { status: "accepted", at: NOW - HOUR + 120_000 },
  ],
  rates: [
    { materialCode: paper.code, paisePerKg: 1400, source: "mine" },
    { materialCode: plastic.code, paisePerKg: 2000, source: "mine" },
  ],
  points: null,
};
const stock: Stock = {
  kind: "kabadiwala",
  buyerKind: "yard",
  rows: [
    {
      material: paper,
      stage: "scrap",
      grams: 260_000,
      marketPaise: 1500,
      valuePaise: 390_000,
      costPaise: null,
      updatedAt: NOW,
    },
  ],
  totalGrams: 260_000,
  totalValuePaise: 390_000,
  totalCostPaise: null,
};
const rateCard: RateCard = {
  city: "Bengaluru",
  rows: materials
    .filter((material) => !isSpecialistMaterial(material))
    .map((material, index) => ({
      material,
      myPaise: 1400 + index * 600,
      floorPaise: 1200 + index * 400,
      fallbackPaise: 1400 + index * 600,
      marketPaise: 1500 + index * 600,
      marketDate: TODAY,
    })),
};
const queue: FunctionReturnType<typeof api.review.queue> = [
  {
    id: "guide-yard" as Id<"applications">,
    kind: "yard",
    status: "submitted",
    name: "Demo sorting yard",
    contactName: "Sample owner",
    phone: undefined,
    area: "Peenya",
    submittedAt: NOW - 26 * HOUR,
    waitingSince: NOW - 26 * HOUR,
    hoursWaiting: 26,
    sla: "overdue",
    fileCount: 4,
    version: 1,
  },
  {
    id: "guide-shop" as Id<"applications">,
    kind: "kabadiwala",
    status: "submitted",
    name: "Demo neighbourhood shop",
    contactName: "Sample owner",
    phone: undefined,
    area: "Yeshwanthpur",
    submittedAt: NOW - 19 * HOUR,
    waitingSince: NOW - 19 * HOUR,
    hoursWaiting: 19,
    sla: "due_soon",
    fileCount: 3,
    version: 1,
  },
  {
    id: "guide-saathi" as Id<"applications">,
    kind: "saathi",
    status: "changes_requested",
    name: "Demo Saathi",
    contactName: undefined,
    phone: undefined,
    area: "Mathikere",
    submittedAt: NOW - 2 * HOUR,
    waitingSince: NOW - 2 * HOUR,
    hoursWaiting: 2,
    sla: "ok",
    fileCount: 2,
    version: 2,
  },
];
/** Populated report for real chart components; every value is synthetic. */
const pilotSummaryFixture: FunctionReturnType<typeof api.pilot.summary> = {
  from: NOW - 7 * 24 * HOUR,
  to: NOW,
  sampleLimit: 1000,
  bookingsTruncated: false,
  applicationsTruncated: false,
  bookings: {
    count: 8,
    outcomes: {
      requested: 2,
      accepted: 1,
      on_the_way: 1,
      completed: 3,
      declined: 1,
      cancelled: 0,
    },
    acceptedCount: 5,
    averageAcceptMs: 120_000,
    reassignedCount: 1,
    completedWithReceipt: 3,
    paidPaise: 81_500,
    estimatedPaise: 80_000,
    weighedGrams: 48_500,
    materials: [
      { code: "PAPER-NEWS", estimatedGrams: 40_000, weighedGrams: 40_500 },
      { code: "PLASTIC-PET", estimatedGrams: 8000, weighedGrams: 8000 },
    ],
  },
  applications: {
    count: 5,
    decidedCount: 3,
    awaitingDecisionCount: 2,
    averageDecisionMs: 4 * HOUR,
  },
};
const saathi: Board = {
  today: TODAY,
  open: [
    {
      id: "guide-open-job" as Id<"jobs">,
      title: "Demo sorting shift: paper and PET",
      kind: "yard_sorting",
      area: "Peenya",
      date: TODAY,
      window: "evening",
      payPaise: 45_000,
      status: "open",
      postedBy: { name: "Demo sorting yard", kind: "yard" },
      inMyArea: false,
    },
  ],
  mine: [
    {
      id: "guide-my-job" as Id<"jobs">,
      title: "Demo home pickups, 4 houses",
      kind: "home_pickups",
      area: "Yeshwanthpur",
      date: TODAY,
      window: "afternoon",
      payPaise: 35_000,
      status: "assigned",
      postedBy: { name: "Demo neighbourhood shop", kind: "kabadiwala" },
      inMyArea: true,
    },
  ],
  done: [],
  earnings: {
    totalPaise: 110_000,
    jobsDone: 2,
    weekPaise: 110_000,
    weekJobs: 2,
  },
};
function isBusinessRole(
  role: string | null,
): role is "yard" | "recycler" | "manufacturer" {
  return ["yard", "recycler", "manufacturer"].includes(role ?? "");
}
export function workspaceFixture(): FunctionReturnType<
  typeof api.workspace.mine
> {
  const role = new URLSearchParams(window.location.search).get("role");
  if (role === "saathi")
    return {
      kind: "saathi",
      saathi: { name: "Demo Saathi", area: "Yeshwanthpur", city: "Bengaluru" },
    };
  const kind = isBusinessRole(role) ? role : "kabadiwala";
  return {
    kind: "org",
    role: "owner",
    org: {
      id: "guide-org" as Id<"orgs">,
      kind,
      name: `Demo ${kind === "kabadiwala" ? "neighbourhood shop" : kind}`,
      slug: `demo-${kind}`,
      area: "Yeshwanthpur",
      city: "Bengaluru",
      offersPickup: true,
      gstin: undefined,
    },
  };
}

export function offersFixture(): FunctionReturnType<typeof api.market.browse> {
  const workspace = workspaceFixture();
  const kind = workspace?.kind === "org" ? workspace.org.kind : "yard";
  const suppliers = {
    manufacturer: "recycler",
    recycler: "yard",
    yard: "kabadiwala",
    kabadiwala: "kabadiwala",
  } as const;
  const sellerKind = suppliers[kind];
  const material: MaterialRef =
    kind === "manufacturer" ? materialRef("RECYCLED-PET-FLAKE") : paper;
  return [
    {
      id: "guide-listing" as Id<"listings">,
      specification: undefined,
      seller: {
        name: "Demo material supplier",
        area: "Peenya",
        kind: sellerKind,
      },
      material,
      grams: 250_000,
      askPaisePerKg: 1500,
      note: "Synthetic material lot for documentation",
      status: "open",
      isMine: false,
      origin: undefined,
      createdAt: NOW - HOUR,
    },
  ];
}

const application: ReviewedApplication = {
  id: "guide-shop" as Id<"applications">,
  kind: "kabadiwala",
  status: "submitted",
  version: 1,
  locale: "en",
  name: "Demo neighbourhood shop",
  phone: "+91••••••0000",
  submittedAt: NOW - 19 * HOUR,
  decidedAt: undefined,
  note: undefined,
  kabadiwala: {
    shopName: "Demo neighbourhood shop",
    gstRegistered: false,
    address: "Sample address, Yeshwanthpur, Bengaluru",
    location: { lat: 13.02, lng: 77.55 },
    ownerName: "Demo shop owner",
    offersPickup: true,
    opens: "09:00",
    closes: "18:00",
    weeklyOff: ["sun"],
  },
  business: undefined,
  saathi: undefined,
  documents: undefined,
  files: [],
  earlierVersions: 0,
  changes: [],
  audit: [],
};
const support: FunctionReturnType<typeof api.support.list> = [
  {
    id: "guide-support" as Id<"supportRequests">,
    name: "Demo shop owner",
    phone: "+91••••••0000",
    role: "kabadiwala",
    topic: "prices",
    message: "Sample help request: how do I change the price for newspaper?",
    status: "open",
    createdAt: NOW - HOUR,
  },
];

export const fixtures: Record<string, unknown> = {
  "identity:me": {
    kind: "admin",
    adminName: "Demo admin",
    hasProfile: true,
    twoFactorEnabled: true,
  },
  "admin:overview": {
    recentSignIns: [
      {
        id: "guide-profile-1",
        phone: undefined,
        locale: "en",
        createdAt: NOW - HOUR,
      },
      {
        id: "guide-profile-2",
        phone: undefined,
        locale: "kn",
        createdAt: NOW - 2 * HOUR,
      },
    ],
  },
  "review:summary": {
    waiting: 2,
    dueSoon: 1,
    overdue: 1,
    withApplicant: 1,
    openSupport: 1,
  },
  "review:queue": queue,
  "review:get": application,
  "support:list": support,
  // Read-only examples. No hazard decision or approval is fabricated.
  "byproductClassification:list": materials.map((material) => ({
    code: material.code,
    name: material.names.en,
    review: null,
  })) satisfies FunctionReturnType<typeof api.byproductClassification.list>,
  "adminPrices:list": rateCard.rows.map((row) => ({
    ...row.material,
    stage: "scrap",
    floorPaise: row.floorPaise,
    fallbackPaise: row.fallbackPaise,
    updatedAt: NOW - HOUR,
  })),
  "pilot:summary": pilotSummaryFixture,
  "shop:requests": requests,
  "shop:get": detail,
  "shop:payouts": {
    todayPaise: 25_050,
    todayCount: 1,
    weekPaise: 81_500,
    weekCount: 3,
  },
  "stock:mine": stock,
  "shop:rateCard": rateCard,
  "shop:dispatchSettings": {
    autoAccept: false,
    pickupRadiusKm: 5,
    canManage: true,
    canAutoAccept: true,
  },
  "catalogue:materials": [
    ...materials.map((material) => ({
      ...material,
      stage: "scrap",
      co2eFactor: 1,
    })),
    {
      code: "RECYCLED-PET-FLAKE",
      family: "plastic",
      stage: "recycled",
      names: materialRef("RECYCLED-PET-FLAKE").names,
      co2eFactor: 1,
    },
  ],
  "market:trades": { buying: [], selling: [] },
  "market:myListings": [],
  "saathi:board": saathi,
};

export const trackedBooking: TrackedBooking = {
  token: "guide-demo-token",
  status: "accepted",
  mode: "pickup",
  slotDate: TODAY,
  slotWindow: "afternoon",
  timeline: detail.timeline,
  items: booking.items,
  estimatePaise: booking.estimatePaise,
  shop: {
    name: "Demo neighbourhood shop",
    area: "Yeshwanthpur",
    address: "Sample shop address, Bengaluru",
    phone: "+91••••••0000",
    hours: { opens: "09:00", closes: "18:00" },
  },
  receipt: undefined,
  points: undefined,
  isMine: true,
  canCancel: true,
  createdAt: NOW - HOUR,
};
const demoTrade: TradeView = {
  specification: undefined,
  id: "guide-trade" as Id<"trades">,
  material: paper,
  grams: 100_000,
  paisePerKg: 1500,
  totalPaise: 150_000,
  status: "accepted",
  timeline: [
    { status: "requested", at: NOW - HOUR },
    { status: "accepted", at: NOW - HOUR + 120_000 },
  ],
  counterparty: {
    name: "Demo neighbourhood shop",
    area: "Yeshwanthpur",
    kind: "kabadiwala",
  },
  invoiceNo: undefined,
  legacyReceiptNo: undefined,
  paymentVerification: "gateway_required",
  needsEwayBill: false,
  inEscrow: false,
  actions: [],
  createdAt: NOW - HOUR,
};
export const tradesFixture: FunctionReturnType<typeof api.market.trades> = {
  buying: [demoTrade],
  selling: [],
};
export const complianceFixture: ComplianceRecord = {
  orgKind: "manufacturer",
  gstin: "DEMO-GSTIN",
  consent: {
    status: "ok",
    board: "KSPCB",
    number: "DEMO-CONSENT-001",
    validUntil: "2028-03-31",
    daysLeft: 534,
    remindOn: "2028-01-01",
  },
  checklist: [
    { id: "gst", status: "done" },
    { id: "consent", status: "done" },
    { id: "scale", status: "self_declared" },
    { id: "safety", status: "self_declared" },
  ],
  receipts: [
    {
      tradeId: "guide-demo-receipt" as Id<"trades">,
      legacyReceiptNo: "DEMO-LG-001",
      recordedAt: NOW - HOUR,
      paymentVerification: "legacy_unverified",
      side: "purchase",
      counterparty: { name: "Demo recycler", kind: "recycler" },
      material: {
        code: "RECYCLED-PET-FLAKE",
        names: materialRef("RECYCLED-PET-FLAKE").names,
        family: "plastic",
      },
      grams: 100_000,
      totalPaise: 650_000,
      needsEwayBill: false,
    },
  ],
  epr: {
    evidenceStatus: "source_records_unverified",
    role: "manufacturer",
    from: "2026-04-01",
    to: "2027-03-31",
    rows: [
      {
        stream: "plastic",
        regime: "pwm_2016",
        receivedGrams: 100_000,
        recycledGrams: 0,
      },
    ],
  },
};

/** Additional examples for changed screens. These do not represent a live ledger. */
export const sellableFixture: SellableItem[] = [
  {
    material: paper,
    stage: "scrap",
    stockGrams: 260_000,
    availableGrams: 200_000,
  },
];
export const priceQuotesFixture: FunctionReturnType<
  typeof api.catalogue.priceQuotes
> = {
  rows: [{ code: paper.code, paisePerKg: 1500 }],
};
export const myListingsFixture: FunctionReturnType<
  typeof api.market.myListings
> = [
  {
    id: "guide-own-listing" as Id<"listings">,
    specification: undefined,
    seller: { name: "Demo sorting yard", kind: "yard", area: "Peenya" },
    material: paper,
    grams: 60_000,
    askPaisePerKg: 1800,
    note: "Synthetic lot: sorted, dry newspaper for documentation.",
    status: "open",
    isMine: true,
    origin: undefined,
    createdAt: NOW - HOUR,
  },
];
export const invoiceFixture: TradeReceipt = {
  id: "guide-receipt" as Id<"trades">,
  number: null,
  legacyReceiptNo: "DEMO-LG-002",
  legacyRecordedAt: NOW - HOUR,
  paymentVerification: "legacy_unverified",
  status: "paid_to_escrow",
  side: "buyer",
  issuedAt: null,
  releasedAt: null,
  seller: {
    name: "Demo neighbourhood shop",
    kind: "kabadiwala",
    address: "Sample shop address, Yeshwanthpur, Bengaluru",
    gstin: undefined,
  },
  buyer: {
    name: "Demo sorting yard",
    kind: "yard",
    address: "Sample yard address, Peenya, Bengaluru",
    gstin: undefined,
  },
  line: { material: paper, grams: 100_000, paisePerKg: 1500, paise: 150_000 },
  totalPaise: 150_000,
  inEscrow: false,
  needsEwayBill: false,
};
export const impactFixture: OrgImpact = {
  kind: "org",
  orgKind: "recycler",
  households: { grams: 0, paise: 0, count: 0 },
  bought: { grams: 160_000, paise: 240_000, count: 2 },
  sold: { grams: 100_000, paise: 180_000, count: 1 },
  recycledGrams: 100_000,
  co2eKg: 100,
  families: [{ family: "paper", grams: 100_000, co2eKg: 100 }],
  since: NOW - 7 * 24 * HOUR,
};

/** Named synthetic missing-factor state; measured material remains visible. */
export const unknownFactorImpactFixture: OrgImpact = {
  ...impactFixture,
  co2eKg: null,
  families: impactFixture.families.map((family) => ({
    ...family,
    co2eKg: null,
  })),
};

/** Draft values are already present on mount; captures never change or save them. */
export function onboardingFixture(): Mine {
  const path = window.location.pathname;
  const kind = path.endsWith("/yard") ? "yard" : "kabadiwala";
  const isSubmitted = path.endsWith("/status");
  return {
    loginPhone: undefined,
    application: {
      id: "guide-onboarding" as Id<"applications">,
      kind,
      status: isSubmitted ? "submitted" : "draft",
      version: isSubmitted ? 1 : 0,
      submittedAt: isSubmitted ? NOW - HOUR : undefined,
      decidedAt: undefined,
      note: undefined,
      kabadiwala:
        kind === "kabadiwala"
          ? {
              ownerName: "Demo shop owner",
              shopName: "Demo neighbourhood shop",
              gstRegistered: false,
              address: "Sample shop address, Yeshwanthpur, Bengaluru",
              offersPickup: true,
              vehicle: "handcart",
              phones: [],
              opens: "09:00",
              closes: "18:00",
              weeklyOff: ["sun"],
            }
          : undefined,
      business:
        kind === "yard"
          ? {
              businessName: "Demo sorting yard",
              gstRegistered: false,
              materials: ["paper", "plastic"],
              address: "Sample yard address, Peenya, Bengaluru",
              locationTags: ["Peenya"],
              collectsFromSuppliers: true,
              phones: [],
              opens: "09:00",
              closes: "18:00",
              weeklyOff: ["sun"],
            }
          : undefined,
      documents: undefined,
      saathi: undefined,
      files: [],
    },
  };
}
