import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { auditShareTables } from "./lib/auditSharesSchema";
import { lifecycleTables } from "./lib/cashfreeLifecycleSchema";
import { cashfreeTables } from "./lib/cashfreeSchema";
import { collaborationTables } from "./lib/collaborationSchema";
import { vEvidenceIssuerKind, vEvidenceKind } from "./lib/commercialEvidence";
import {
  draftSections,
  vApplicationKind,
  vApplicationStatus,
  vFileType,
  vRadius,
  vSaathiTime,
  vSaathiVehicle,
  vSaathiWork,
  vShopVehicle,
  vWeekday,
} from "./lib/drafts";
import {
  vHandlingClass,
  vProcessKind,
  vRegistrationKind,
  vSectorSnapshot,
  vStreamClass,
} from "./lib/industrialClassification";
import { vIntegrationScope } from "./lib/integrations";
import { vMaterialOfferSpecification } from "./lib/materialOfferSpecification";
import { vConversationKind, vConversationStatus } from "./lib/messaging";
import {
  vInboxEvent,
  vNotificationEvent,
  vNotificationStatus,
} from "./lib/notificationConfig";
import { operationalTables } from "./lib/operationalSchema";
import { organizationTables } from "./lib/organizationsSchema";
import { publicDataFields } from "./lib/publicData";
import { qualityFileTables } from "./lib/qualityFilesSchema";
import { routePlanningTables } from "./lib/routePlanningSchema";
import { vMaterialOrigin, vSiteType } from "./lib/siteClassification";
import { sourcingTables } from "./lib/sourcingSchema";
import { vStakeholderKind, vStakeholderStatus } from "./lib/stakeholderKinds";
import {
  vBookingStatus,
  vFamily,
  vOrgKind,
  vTradeStatus,
} from "./lib/validators";
import { vInvitationRole, vMembershipRole } from "./lib/workspaceRoles";

/**
 * Luma.Green data model — docs/architecture/data-model.md.
 *
 * Material moves up the chain: households → kabadiwalas → yards → recyclers
 * → manufacturers. Each step is on the ledger: bookings and receipts, stock,
 * listings and trades.
 *
 * Money is stored in paise (integer) and mass in grams (integer). Never float:
 * a rounding drift in either column is a compliance problem, not a UI bug.
 */

const timestamps = {
  createdAt: v.number(),
  updatedAt: v.number(),
};

export default defineSchema({
  identityCheckDays: defineTable({
    day: v.string(),
    used: v.number(),
    operatorUsed: v.optional(v.number()),
    examplePan: v.optional(v.boolean()),
    exampleGst: v.optional(v.boolean()),
  }).index("by_day", ["day"]),
  identityPersonCheckDays: defineTable({
    profileId: v.id("profiles"),
    day: v.string(),
    used: v.number(),
  }).index("by_profile_day", ["profileId", "day"]),
  identityChecks: defineTable({
    applicationId: v.id("applications"),
    kind: v.union(v.literal("pan"), v.literal("gst")),
    input: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_application_kind", ["applicationId", "kind"]),
  /** Operator-imported synthetic demo identities; no passwords or sessions. */
  investorDemoAccounts: defineTable({
    batchKey: v.string(),
    personaKey: v.string(),
    email: v.string(),
    authUserId: v.string(),
    profileId: v.id("profiles"),
    passwordHashDigest: v.string(),
    createdAt: v.number(),
  })
    .index("by_batch_persona", ["batchKey", "personaKey"])
    .index("by_email", ["email"])
    .index("by_auth_user", ["authUserId"]),
  /** Exact inserted-record inventory for bounded reruns and later cleanup review. */
  investorDemoRecords: defineTable({
    batchKey: v.string(),
    key: v.string(),
    table: v.string(),
    recordId: v.string(),
    createdAt: v.number(),
  })
    .index("by_batch_key", ["batchKey", "key"])
    .index("by_batch", ["batchKey"]),
  ...operationalTables,
  ...sourcingTables,
  ...routePlanningTables,
  ...qualityFileTables,
  ...organizationTables,
  ...collaborationTables,
  ...auditShareTables,
  ...cashfreeTables,
  ...lifecycleTables,
  /** Isolated demonstration records. Never used as operational platform records. */
  demoWorkspaces: defineTable({
    key: v.string(),
    version: v.number(),
    label: v.string(),
    payload: v.string(),
    checksum: v.string(),
    ...timestamps,
  }).index("by_key", ["key"]),

  publicDataSnapshots: defineTable(publicDataFields).index("by_provider_city", [
    "provider",
    "city",
  ]),
  /** Private account inbox. Event labels are translated when displayed. */
  inbox: defineTable({
    profileId: v.id("profiles"),
    dedupKey: v.string(),
    event: vInboxEvent,
    taskId: v.optional(v.id("recordTasks")),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_dedupKey", ["dedupKey"])
    .index("by_profile_created", ["profileId", "createdAt"])
    .index("by_profile_read", ["profileId", "read"]),

  /** Secrets are only returned to an internal delivery action, never a client. */
  pushDevices: defineTable({
    profileId: v.id("profiles"),
    // Legacy unbound registrations stay inactive until authenticated renewal.
    sessionId: v.optional(v.string()),
    installationId: v.string(),
    fingerprint: v.string(),
    channel: v.union(v.literal("web"), v.literal("expo")),
    endpoint: v.string(),
    keys: v.optional(v.object({ p256dh: v.string(), auth: v.string() })),
    locale: v.string(),
    expiresAt: v.number(),
    ...timestamps,
  })
    .index("by_fingerprint", ["fingerprint"])
    .index("by_profile", ["profileId"])
    .index("by_profile_installation", ["profileId", "installationId"]),

  pushLimits: defineTable({
    profileId: v.id("profiles"),
    windowStart: v.number(),
    registrations: v.number(),
  }).index("by_profile", ["profileId"]),

  /** A send is claimed once. Unknown delivery is never automatically retried. */
  pushDeliveries: defineTable({
    inboxId: v.id("inbox"),
    deviceId: v.id("pushDevices"),
    profileId: v.id("profiles"),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("accepted"),
      v.literal("failed"),
      v.literal("unknown"),
      v.literal("cancelled"),
    ),
    attemptedAt: v.optional(v.number()),
    receiptId: v.optional(v.string()),
    ...timestamps,
  })
    .index("by_inbox_device", ["inboxId", "deviceId"])
    .index("by_profile_attemptedAt", ["profileId", "attemptedAt"]),

  /** Transactional SMS events. No phone, tracking token, OTP or provider body. */
  smsNotifications: defineTable({
    dedupKey: v.string(),
    attemptedAt: v.optional(v.number()),
    event: vNotificationEvent,
    status: vNotificationStatus,
    profileId: v.id("profiles"),
    locale: v.string(),
    revision: v.number(),
    bookingId: v.optional(v.id("bookings")),
    applicationId: v.optional(v.id("applications")),
    orgId: v.optional(v.id("orgs")),
    templateId: v.optional(v.string()),
    templateLocale: v.optional(v.string()),
    ...timestamps,
  })
    .index("by_dedupKey", ["dedupKey"])
    .index("by_profile_attemptedAt", ["profileId", "attemptedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  /**
   * One row per signed-in person, linked to their Better Auth user (which
   * lives inside the auth component). `kind` separates platform staff from
   * everyone else — see docs/architecture/auth.md.
   */
  profiles: defineTable({
    authUserId: v.string(),
    /** Selection only. Every request must still verify the current membership. */
    activeOrgId: v.optional(v.id("orgs")),
    phone: v.optional(v.string()), // E.164, verified by SMS code
    kind: v.union(v.literal("member"), v.literal("admin")),
    locale: v.string(),
    ...timestamps,
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_phone", ["phone"]),

  /**
   * The one admin's identity record. Never used to sign in, and never a full
   * Aadhaar number — only the last four digits (docs/operations/data-protection.md).
   */
  adminProfiles: defineTable({
    profileId: v.id("profiles"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    dateOfBirth: v.string(), // YYYY-MM-DD
    aadhaarLast4: v.string(),
    ...timestamps,
  }).index("by_profileId", ["profileId"]),

  /**
   * One per person joining as a business or a Saathi — docs/product/onboarding.md.
   * The form is saved here as a draft while they fill it in; the business or
   * Saathi record itself is created when the admin approves.
   */
  applications: defineTable({
    organizationId: v.optional(v.id("organizations")),
    profileId: v.id("profiles"),
    kind: vApplicationKind,
    status: vApplicationStatus,
    /** Goes up by one on every submit; 0 while never sent. */
    version: v.number(),
    locale: v.string(),
    ageConfirmedAt: v.number(),
    privacyAcceptedAt: v.number(),
    ...draftSections,
    submittedAt: v.optional(v.number()),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("profiles")),
    /** The admin's note on changes requested or a rejection. */
    note: v.optional(v.string()),
    ...timestamps,
  })
    .index("by_profile", ["profileId"])
    .index("by_profile_organization", ["profileId", "organizationId"])
    .index("by_organization_created", ["organizationId", "createdAt"])
    .index("by_status_submittedAt", ["status", "submittedAt"])
    .index("by_submittedAt", ["submittedAt"]),

  /** Default-deny stakeholder identities, separate from trading orgs. */
  stakeholderAccounts: defineTable({
    ownerProfileId: v.id("profiles"),
    ageConfirmedAt: v.optional(v.number()),
    privacyAcceptedAt: v.optional(v.number()),
    kind: vStakeholderKind,
    /** Required for material generators; optional for earlier stakeholders. */
    siteType: v.optional(vSiteType),
    organizationName: v.string(),
    status: vStakeholderStatus,
    reviewedBy: v.optional(v.id("profiles")),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
    ...timestamps,
  })
    .index("by_owner", ["ownerProfileId"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  /** What was sent at each version, so the admin can see what changed. */
  applicationSnapshots: defineTable({
    applicationId: v.id("applications"),
    version: v.number(),
    ...draftSections,
    fileIds: v.array(v.id("applicationFiles")),
    submittedAt: v.number(),
  }).index("by_application_version", ["applicationId", "version"]),

  /**
   * Uploads: PCB certificates, machine photos and videos, photo IDs, selfies.
   * Private — served only through a permission-checked HTTP action, never a
   * storage URL. A file that was part of a submitted version is only marked
   * removed, so earlier versions stay complete.
   */
  applicationFiles: defineTable({
    applicationId: v.id("applications"),
    profileId: v.id("profiles"),
    type: vFileType,
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    firstSubmittedVersion: v.optional(v.number()),
    removedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_application", ["applicationId"])
    .index("by_storageId", ["storageId"]),

  // --- Catalogue and prices ------------------------------------------------

  /**
   * The material catalogue — Luma.Green's shared material codes. Names are
   * data (per language, English as the fallback), so adding a material needs
   * no code change. The admin bootstrap adds missing canonical definitions;
   * rates and reviewed factors are separate operational inputs.
   */
  materials: defineTable({
    code: v.string(), // e.g. "PAPER-NEWS"
    family: vFamily,
    stage: v.union(v.literal("scrap"), v.literal("recycled")),
    names: v.record(v.string(), v.string()), // locale → name
    /** kg CO2e per kg. Absent means unknown, never an assumed zero. */
    co2eFactor: v.optional(v.number()),
    sortOrder: v.number(),
    active: v.boolean(),
    /** Admin-reviewed evidence gate; absent means not classified. */
    byproductEligibility: v.optional(
      v.object({
        hazardStatus: v.union(
          v.literal("non_hazardous"),
          v.literal("hazardous"),
        ),
        sourceReference: v.string(),
        reviewedAt: v.number(),
        reviewedByProfileId: v.optional(v.id("profiles")),
      }),
    ),
  })
    .index("by_code", ["code"])
    .index("by_sortOrder", ["sortOrder"]),

  /** The admin's floor and fallback price per material per city. */
  referencePrices: defineTable({
    city: v.string(),
    materialCode: v.string(),
    floorPaise: v.number(), // per kg; a kabadiwala can't offer less
    fallbackPaise: v.number(), // per kg; used when a shop hasn't set a price
    updatedAt: v.number(),
  }).index("by_city_material", ["city", "materialCode"]),

  /** The daily market price per material per city, for the price board. */
  marketPrices: defineTable({
    city: v.string(),
    materialCode: v.string(),
    date: v.string(), // YYYY-MM-DD, India time
    paisePerKg: v.number(),
  }).index("by_city_material_date", ["city", "materialCode", "date"]),

  /** What one shop pays households, per material. */
  rateCards: defineTable({
    orgId: v.id("orgs"),
    materialCode: v.string(),
    paisePerKg: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_material", ["orgId", "materialCode"])
    .index("by_material", ["materialCode"]),

  // --- Businesses and Saathis -----------------------------------------------

  /** An approved business: created when the admin approves its application. */
  orgs: defineTable({
    organizationId: v.optional(v.id("organizations")),
    kind: vOrgKind,
    /** Optional for existing rows; a physical site is separate from org kind. */
    siteType: v.optional(vSiteType),
    /** Sources this organisation declared, not a legal classification. */
    materialOrigins: v.optional(v.array(vMaterialOrigin)),
    name: v.string(),
    slug: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended")),
    ownerProfileId: v.optional(v.id("profiles")),
    applicationId: v.optional(v.id("applications")),
    city: v.string(),
    area: v.string(),
    address: v.string(),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    phones: v.array(v.object({ number: v.string(), label: v.string() })),
    hours: v.optional(v.object({ opens: v.string(), closes: v.string() })),
    weeklyOff: v.array(vWeekday),
    gstin: v.optional(v.string()),
    families: v.array(vFamily),
    offersPickup: v.boolean(),
    autoAccept: v.optional(v.boolean()),
    pickupRadiusKm: v.optional(v.number()),
    vehicle: v.optional(vShopVehicle),
    consent: v.optional(
      v.object({
        board: v.string(),
        number: v.string(),
        validUntil: v.string(),
      }),
    ),
    ...timestamps,
  })
    .index("by_organization", ["organizationId"])
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerProfileId"])
    .index("by_kind_city", ["kind", "city", "status"])
    .index("by_kind_city_pickup", ["kind", "city", "status", "offersPickup"]),

  /** Who can act for which business. */
  memberships: defineTable({
    profileId: v.id("profiles"),
    orgId: v.id("orgs"),
    role: vMembershipRole,
    createdAt: v.number(),
  })
    .index("by_profile", ["profileId"])
    .index("by_profile_org", ["profileId", "orgId"])
    .index("by_org", ["orgId"])
    .index("by_org_profile", ["orgId", "profileId"]),

  /** One-use, verified-email-bound team invitations; raw tokens are not stored. */
  workspaceInvitations: defineTable({
    orgId: v.id("orgs"),
    email: v.string(),
    role: vInvitationRole,
    tokenHash: v.string(),
    invitedBy: v.id("profiles"),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.id("profiles")),
    revokedAt: v.optional(v.number()),
    attemptedAt: v.optional(v.number()),
    delivery: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("failed"),
    ),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_email", ["orgId", "email"]),

  /** Machine credentials. Plain tokens are returned once and never stored. */
  integrationKeys: defineTable({
    orgId: v.id("orgs"),
    issuerProfileId: v.id("profiles"),
    label: v.string(),
    prefix: v.string(),
    keyHash: v.string(),
    scopes: v.array(vIntegrationScope),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    windowStartedAt: v.number(),
    requestsInWindow: v.number(),
  })
    .index("by_hash", ["keyHash"])
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_revoked_expires", ["orgId", "revokedAt", "expiresAt"]),

  /** One fixed-window request counter per business, shared by all its keys. */
  integrationUsage: defineTable({
    orgId: v.id("orgs"),
    windowStartedAt: v.number(),
    requestsInWindow: v.number(),
  }).index("by_org", ["orgId"]),

  /** Fixed global cost bound for optional industry-news provider requests. */
  integrationNewsQuota: defineTable({
    key: v.literal("global"),
    startedAt: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  /** An approved Saathi. */
  saathiProfiles: defineTable({
    profileId: v.id("profiles"),
    applicationId: v.optional(v.id("applications")),
    name: v.string(),
    city: v.string(),
    area: v.string(),
    radiusKm: vRadius,
    workTypes: v.array(vSaathiWork),
    vehicle: vSaathiVehicle,
    times: v.array(vSaathiTime),
    days: v.array(vWeekday),
    status: v.union(v.literal("active"), v.literal("suspended")),
    createdAt: v.number(),
  }).index("by_profile", ["profileId"]),

  // --- Household pickups ------------------------------------------------------

  /** A household's pickup or drop-off, tracked at /t/{token}. */
  householdPhotos: defineTable({
    profileId: v.id("profiles"),
    bookingId: v.optional(v.id("bookings")),
    storageId: v.optional(v.id("_storage")),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_profile_createdAt", ["profileId", "createdAt"])
    .index("by_booking", ["bookingId"]),

  bookings: defineTable({
    token: v.string(),
    householdProfileId: v.optional(v.id("profiles")),
    phone: v.string(),
    name: v.optional(v.string()),
    mode: v.union(v.literal("pickup"), v.literal("dropoff")),
    items: v.array(v.object({ materialCode: v.string(), estKg: v.number() })),
    estimatePaise: v.optional(v.number()),
    requestKind: v.optional(v.literal("photo_request")),
    photoRequestKey: v.optional(v.string()),
    orgId: v.id("orgs"),
    slotDate: v.string(), // YYYY-MM-DD
    slotWindow: vSaathiTime,
    address: v.optional(v.string()),
    dispatch: v.optional(
      v.object({
        attempt: v.number(),
        offeredAt: v.number(),
        expiresAt: v.optional(v.number()),
        attemptedOrgIds: v.array(v.id("orgs")),
        origin: v.optional(v.object({ lat: v.number(), lng: v.number() })),
        approximateLocation: v.boolean(),
      }),
    ),
    status: vBookingStatus,
    timeline: v.array(v.object({ status: vBookingStatus, at: v.number() })),
    receipt: v.optional(
      v.object({
        lines: v.array(
          v.object({
            materialCode: v.string(),
            grams: v.number(),
            paisePerKg: v.number(),
            paise: v.number(),
          }),
        ),
        totalPaise: v.number(),
        method: v.union(v.literal("cash"), v.literal("upi")),
        paidAt: v.number(),
      }),
    ),
    points: v.optional(v.number()),
    ...timestamps,
  })
    .index("by_token", ["token"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_household", ["householdProfileId"])
    .index("by_createdAt", ["createdAt"]),

  /** Immutable offer events; a booking can pass through several shops. */
  bookingOffers: defineTable({
    bookingId: v.id("bookings"),
    orgId: v.id("orgs"),
    attempt: v.number(),
    event: v.union(
      v.literal("offered"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("timed_out"),
    ),
    createdAt: v.number(),
  }).index("by_booking", ["bookingId"]),

  /** Internal SMS send limits. Phone numbers are hashed before insertion. */
  smsRateLimits: defineTable({
    phoneHash: v.string(),
    sentAt: v.array(v.number()),
  }).index("by_phone_hash", ["phoneHash"]),

  /** Short-lived hashed request counters only. No photos or model responses. */
  photoEstimateQuota: defineTable({
    key: v.literal("global"),
    cleanupScheduledAt: v.optional(v.number()),
    reservations: v.array(
      v.object({
        at: v.number(),
        deviceHash: v.string(),
        phoneHash: v.optional(v.string()),
      }),
    ),
  }).index("by_key", ["key"]),

  // --- Stock and trade --------------------------------------------------------

  /** Stock of one material at one business. */
  /** Immutable own-production intake. This is separate from evidence-only lots. */
  manufacturerStockIntakes: defineTable({
    orgId: v.id("orgs"),
    actorProfileId: v.id("profiles"),
    intakeReference: v.string(),
    materialCode: v.string(),
    grams: v.number(),
    producedOn: v.string(),
    sourceReference: v.string(),
    weighingReference: v.string(),
    ownProductionConfirmed: v.literal(true),
    createdAt: v.number(),
  })
    .index("by_org_reference", ["orgId", "intakeReference"])
    .index("by_org_created", ["orgId", "createdAt"]),

  inventory: defineTable({
    orgId: v.id("orgs"),
    materialCode: v.string(),
    grams: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_material", ["orgId", "materialCode"]),

  /** Reported document references only. No regulatory approval or trade rights. */
  facilityRegistrations: defineTable({
    facilityId: v.id("industrialFacilities"),
    orgId: v.id("orgs"),
    kind: vRegistrationKind,
    reference: v.string(),
    issuedAt: v.string(),
    validUntil: v.string(),
    supersedesId: v.optional(v.id("facilityRegistrations")),
    actorProfileId: v.id("profiles"),
    recordedAt: v.number(),
    sourceQuality: v.literal("reported_unverified"),
  })
    .index("by_facility_recorded", ["facilityId", "recordedAt"])
    .index("by_supersedes", ["supersedesId"]),

  /** Self-declared processes; no role, trading or regulatory permission is granted. */
  industrialFacilities: defineTable({
    revision: v.optional(v.number()),
    orgId: v.id("orgs"),
    name: v.string(),
    siteReference: v.string(),
    sectorId: v.optional(v.string()),
    sector: v.optional(vSectorSnapshot),
    capabilities: v.array(vProcessKind),
    createdByProfileId: v.id("profiles"),
    updatedByProfileId: v.id("profiles"),
    ...timestamps,
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_updated", ["updatedAt"]),

  /** Append-only declared controlled routing evidence, not approval or disposal certification. */
  lotControlledDispositions: defineTable({
    lotId: v.id("materialLots"),
    orgId: v.id("orgs"),
    grams: v.number(),
    destinationReference: v.string(),
    reviewedDestinationId: v.optional(v.id("controlledDestinations")),
    authorisationReference: v.string(),
    manifestReference: v.string(),
    actorProfileId: v.id("profiles"),
    createdAt: v.number(),
  }).index("by_lot_created", ["lotId", "createdAt"]),

  /** Physical evidence only. A declared lot is not verified stock or title. */
  materialLots: defineTable({
    orgId: v.id("orgs"),
    declaredByOrgId: v.id("orgs"),
    materialCode: v.string(),
    state: v.string(),
    streamClass: v.optional(vStreamClass),
    handlingClass: v.optional(vHandlingClass),
    sourceKind: v.union(v.literal("self_declared"), v.literal("transformed")),
    sourceReference: v.optional(v.string()),
    parentTransformationId: v.optional(v.id("lotTransformations")),
    initialGrams: v.number(),
    availableGrams: v.number(),
    status: v.union(
      v.literal("available"),
      v.literal("in_transit"),
      v.literal("exhausted"),
    ),
    pendingReceiverOrgId: v.optional(v.id("orgs")),
    pendingDispatchId: v.optional(v.id("lotCustodyEvents")),
    createdByProfileId: v.id("profiles"),
    ...timestamps,
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_declared_org_created", ["declaredByOrgId", "createdAt"])
    .index("by_org_material_created", ["orgId", "materialCode", "createdAt"])
    .index("by_parent_transformation", ["parentTransformationId"])
    .index("by_pending_receiver", ["pendingReceiverOrgId"]),

  /** Append-only physical hand-offs. Title and payment live elsewhere. */
  lotCustodyEvents: defineTable({
    lotId: v.id("materialLots"),
    kind: v.union(v.literal("dispatched"), v.literal("received")),
    fromOrgId: v.id("orgs"),
    toOrgId: v.id("orgs"),
    grams: v.number(),
    dispatchId: v.optional(v.id("lotCustodyEvents")),
    actorProfileId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("by_lot_created", ["lotId", "createdAt"])
    .index("by_from_created", ["fromOrgId", "createdAt"])
    .index("by_to_created", ["toOrgId", "createdAt"]),

  /** Every consumed input is an immutable edge of one transformation. */
  lotTransformationInputs: defineTable({
    transformationId: v.id("lotTransformations"),
    lotId: v.id("materialLots"),
    materialCode: v.string(),
    state: v.string(),
    grams: v.number(),
    createdAt: v.number(),
  })
    .index("by_lot_created", ["lotId", "createdAt"])
    .index("by_transformation", ["transformationId"]),

  /** Primary input anchors legacy history; edges record all consumed input lots. */
  lotTransformations: defineTable({
    facilityId: v.optional(v.id("industrialFacilities")),
    facilityName: v.optional(v.string()),
    processKind: v.optional(vProcessKind),
    orgId: v.id("orgs"),
    inputLotId: v.id("materialLots"),
    inputGrams: v.number(),
    contaminationGrams: v.number(),
    processLossGrams: v.number(),
    actorProfileId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("by_input_lot_created", ["inputLotId", "createdAt"])
    .index("by_org_created", ["orgId", "createdAt"]),

  /** Inspection results stay immutable, including proposed corrections. */
  lotInspections: defineTable({
    lotId: v.id("materialLots"),
    orgId: v.id("orgs"),
    buyerOrgId: v.optional(v.id("orgs")),
    assessmentScope: v.literal("inspecting_org"),
    specificationReference: v.string(),
    specificationVersion: v.string(),
    sampleMethod: v.string(),
    results: v.array(
      v.object({ parameter: v.string(), unit: v.string(), value: v.string() }),
    ),
    decision: v.union(
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("conditional"),
    ),
    evidenceReference: v.optional(v.string()),
    supersedesInspectionId: v.optional(v.id("lotInspections")),
    correctionReason: v.optional(v.string()),
    actorProfileId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("by_lot_created", ["lotId", "createdAt"])
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_supersedes", ["supersedesInspectionId"]),

  /** Separate approval means no accepted inspection row is ever patched. */
  lotInspectionApprovals: defineTable({
    inspectionId: v.id("lotInspections"),
    supersededInspectionId: v.id("lotInspections"),
    orgId: v.id("orgs"),
    approverProfileId: v.id("profiles"),
    createdAt: v.number(),
  })
    .index("by_inspection", ["inspectionId"])
    .index("by_superseded", ["supersededInspectionId"]),

  /** A lot offered to the next business up the chain. */
  listings: defineTable({
    specification: v.optional(vMaterialOfferSpecification),
    orgId: v.id("orgs"),
    sellerKind: vOrgKind,
    materialCode: v.string(),
    grams: v.number(),
    askPaisePerKg: v.number(),
    city: v.string(),
    note: v.optional(v.string()),
    /** Manufacturer offers require an admin-reviewed non-hazardous material. */
    origin: v.optional(v.literal("manufacturer_byproduct")),
    status: v.union(
      v.literal("open"),
      v.literal("sold"),
      v.literal("withdrawn"),
    ),
    ...timestamps,
  })
    .index("by_status_kind", ["status", "sellerKind"])
    .index("by_org", ["orgId"]),

  /**
   * A purchase between two businesses. Legacy prototype payment statuses and
   * receipt numbers remain for history but do not prove payment or invoicing.
   * New trades stop at acceptance until a verified gateway is integrated.
   */
  trades: defineTable({
    specification: v.optional(vMaterialOfferSpecification),
    listingId: v.id("listings"),
    sellerOrgId: v.id("orgs"),
    buyerOrgId: v.id("orgs"),
    materialCode: v.string(),
    grams: v.number(),
    paisePerKg: v.number(),
    totalPaise: v.number(),
    status: vTradeStatus,
    timeline: v.array(v.object({ status: vTradeStatus, at: v.number() })),
    invoiceNo: v.optional(v.string()),
    ...timestamps,
  })
    .index("by_seller", ["sellerOrgId"])
    .index("by_buyer", ["buyerOrgId"])
    .index("by_listing", ["listingId"]),

  /**
   * User-reported references to documents issued outside Luma. A correction
   * inserts another row and points to the old one; neither row proves validity.
   */
  commercialEvidence: defineTable({
    orgId: v.id("orgs"),
    tradeId: v.optional(v.id("trades")),
    kind: vEvidenceKind,
    reference: v.string(),
    issuerKind: vEvidenceIssuerKind,
    issuerName: v.string(),
    issuedAt: v.optional(v.number()),
    supersedesId: v.optional(v.id("commercialEvidence")),
    recordedByProfileId: v.id("profiles"),
    version: v.number(),
    createdAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_trade_created", ["tradeId", "createdAt"])
    .index("by_supersedes", ["supersedesId"]),

  // --- Saathi work --------------------------------------------------------------

  /** A business's material requirement, with an explicit quantity and due date. */
  materialDemands: defineTable({
    orgId: v.id("orgs"),
    buyerKind: vOrgKind,
    family: vFamily,
    createdBy: v.id("profiles"),
    materialCode: v.string(),
    quantityGrams: v.number(),
    city: v.string(),
    area: v.string(),
    specification: v.string(),
    neededBy: v.string(),
    status: v.union(v.literal("open"), v.literal("closed")),
    ...timestamps,
  })
    .index("by_org", ["orgId"])
    .index("by_city_status_family_neededBy", [
      "city",
      "status",
      "family",
      "neededBy",
    ])
    .index("by_city_status_buyerKind_family_neededBy", [
      "city",
      "status",
      "buyerKind",
      "family",
      "neededBy",
    ]),

  /** Paid work a business posts for Saathis. */
  jobs: defineTable({
    orgId: v.optional(v.id("orgs")),
    // Optional while workforce.backfillJobCities migrates existing business jobs.
    city: v.optional(v.string()),
    kind: vSaathiWork,
    title: v.string(),
    area: v.string(),
    date: v.string(),
    window: vSaathiTime,
    payPaise: v.number(),
    status: v.union(
      v.literal("open"),
      v.literal("assigned"),
      v.literal("done"),
    ),
    saathiProfileId: v.optional(v.id("saathiProfiles")),
    cancelledAt: v.optional(v.number()),
    createdBy: v.optional(v.id("profiles")),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["status"])
    .index("by_city_status_cancelledAt_date", [
      "city",
      "status",
      "cancelledAt",
      "date",
    ])
    .index("by_org_status_cancelledAt_date", [
      "orgId",
      "status",
      "cancelledAt",
      "date",
    ])
    .index("by_saathi", ["saathiProfileId"]),

  // --- Help -----------------------------------------------------------------------

  /** One support thread per profile, or one private thread per existing trade. */
  conversations: defineTable({
    kind: vConversationKind,
    status: vConversationStatus,
    subject: v.string(),
    supportProfileId: v.optional(v.id("profiles")),
    tradeId: v.optional(v.id("trades")),
    sellerOrgId: v.optional(v.id("orgs")),
    buyerOrgId: v.optional(v.id("orgs")),
    ...timestamps,
  })
    .index("by_supportProfile", ["supportProfileId"])
    .index("by_trade", ["tradeId"])
    .index("by_seller_updatedAt", ["sellerOrgId", "updatedAt"])
    .index("by_buyer_updatedAt", ["buyerOrgId", "updatedAt"])
    .index("by_kind_status_updatedAt", ["kind", "status", "updatedAt"]),

  /** Append-only message bodies, accessible only through conversation permissions. */
  conversationMessages: defineTable({
    conversationId: v.id("conversations"),
    senderProfileId: v.id("profiles"),
    senderRole: v.union(v.literal("member"), v.literal("admin")),
    senderOrgId: v.optional(v.id("orgs")),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_conversation_createdAt", ["conversationId", "createdAt"])
    .index("by_sender_createdAt", ["senderProfileId", "createdAt"]),

  /** Messages from the help centre and the solar page, for the team to answer. */
  supportRequests: defineTable({
    profileId: v.optional(v.id("profiles")),
    name: v.string(),
    phone: v.string(),
    role: v.string(),
    topic: v.string(),
    message: v.string(),
    status: v.union(v.literal("open"), v.literal("answered")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_phone_createdAt", ["phone", "createdAt"]),

  /** Immutable audit trail. Anything a regulator could ask about lands here. */
  auditLog: defineTable({
    orgId: v.optional(v.id("orgs")),
    /** The signed-in person behind the change. */
    actorProfileId: v.optional(v.id("profiles")),
    action: v.string(), // "trade.settled", "credit.retired", …
    entityTable: v.string(),
    entityId: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_entity", ["entityTable", "entityId"]),
});
