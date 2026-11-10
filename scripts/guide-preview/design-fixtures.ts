import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { subscriptionPlans } from "../../convex/lib/subscriptions";
import { NOW } from "./fixtures";

/** Isolated display records only. No account, provider or permit is verified. */
export const designFixtures = {
  "sourcing:options": {
    materials: [],
    suppliers: [],
    truncated: false,
  } satisfies FunctionReturnType<typeof api.sourcing.options>,
  "privacyRequests:queue": [] satisfies FunctionReturnType<
    typeof api.privacyRequests.queue
  >,
  "stakeholderAccounts:pending": [] satisfies FunctionReturnType<
    typeof api.stakeholderAccounts.pending
  >,
  "cashfreeLifecycle:policyForAdmin": {
    configuredVersion: null,
    liveEnabled: false,
    policy: null,
  } satisfies FunctionReturnType<typeof api.cashfreeLifecycle.policyForAdmin>,
  "adminCollections:apartmentRoutes": [] satisfies FunctionReturnType<
    typeof api.adminCollections.apartmentRoutes
  >,
  "adminCollections:apartmentChoices": {
    partners: [],
    shops: [],
  } satisfies FunctionReturnType<typeof api.adminCollections.apartmentChoices>,
  "identityChecks:gst": null satisfies FunctionReturnType<
    typeof api.identityChecks.gst
  >,
  "identityDiscovery:current": null satisfies FunctionReturnType<
    typeof api.identityDiscovery.current
  >,
  "cashfreePayments:setupConfigurationForAdmin": {
    mode: null,
    sandboxCheckout: false,
  } satisfies FunctionReturnType<
    typeof api.cashfreePayments.setupConfigurationForAdmin
  >,
  "integrations:listKeys": {
    canManage: true,
    keys: [],
  } satisfies FunctionReturnType<typeof api.integrations.listKeys>,
  "operationalCatalogue:active": {
    rows: [],
    truncated: false,
  } satisfies FunctionReturnType<typeof api.operationalCatalogue.active>,
  "complianceReview:myReviews": [] satisfies FunctionReturnType<
    typeof api.complianceReview.myReviews
  >,
  "production:mine": {
    recipes: [],
    batches: [],
    transformations: [],
    truncated: false,
  } satisfies FunctionReturnType<typeof api.production.mine>,
  "paperDrafts:availability": {
    assisted: false,
    canOperate: true,
  } satisfies FunctionReturnType<typeof api.paperDrafts.availability>,
  "demand:board": {
    today: "2026-10-14",
    maxDate: "2026-11-14",
    canPost: true,
    materials: [],
    mine: [],
    available: [],
    truncated: false,
  } satisfies FunctionReturnType<typeof api.demand.board>,
  "privacyRequests:mine": [] satisfies FunctionReturnType<
    typeof api.privacyRequests.mine
  >,
  "workspace:invitation": {
    status: "ready",
    orgName: "Synthetic invitation — example workspace",
    role: "viewer",
  } satisfies FunctionReturnType<typeof api.workspace.invitation>,
  "households:mine": [
    {
      token: "guide-booking",
      status: "requested",
      mode: "pickup",
      slotDate: "2026-10-14",
      slotWindow: "morning",
      shopName: "Synthetic collection shop",
      itemCount: 0,
      estGrams: 0,
      estimatePaise: undefined,
      paidPaise: undefined,
      createdAt: NOW,
    },
  ] satisfies FunctionReturnType<typeof api.households.mine>,
  "householdFamily:mine": {
    canInvite: true,
    invited: [],
    joined: [],
  } satisfies FunctionReturnType<typeof api.householdFamily.mine>,
  "householdFamily:collections": [] satisfies FunctionReturnType<
    typeof api.householdFamily.collections
  >,
  "householdLookups:availability": {
    air: false,
    solar: false,
  } satisfies FunctionReturnType<typeof api.householdLookups.availability>,
  "stakeholderAccounts:mine": null satisfies FunctionReturnType<
    typeof api.stakeholderAccounts.mine
  >,
  "stakeholderAccounts:mineForParticipant": null satisfies FunctionReturnType<
    typeof api.stakeholderAccounts.mineForParticipant
  >,
  "businessSubscriptions:catalogue": {
    version: 1,
    plans: subscriptionPlans.map((plan) => ({ ...plan })),
  } satisfies FunctionReturnType<typeof api.businessSubscriptions.catalogue>,
  "businessSubscriptions:status": {
    billingAvailable: false,
    canManage: true,
    memberCount: 1,
    drafts: [],
    request: null,
    entitlement: null,
    events: [],
  } satisfies FunctionReturnType<typeof api.businessSubscriptions.status>,
  "industrialProfiles:mine": [
    {
      _id: "guide-facility" as Id<"industrialFacilities">,
      name: "Synthetic facility — design fixture",
      siteReference: "Isolated example, not an operating site",
      sectorId: undefined,
      sector: undefined,
      capabilities: [],
      createdAt: NOW,
      updatedAt: NOW,
    },
  ] satisfies FunctionReturnType<typeof api.industrialProfiles.mine>,
  "industrialProfiles:registrations": {
    rows: [],
    hasMore: false,
  } satisfies FunctionReturnType<typeof api.industrialProfiles.registrations>,
  "industryReference:search": {
    sourceQuality: "workbook_unverified",
    sourceLanguage: "en",
    sourceWorkbook: "Isolated empty design fixture",
    items: [],
    total: 0,
    nextOffset: null,
  } satisfies FunctionReturnType<typeof api.industryReference.search>,
};
