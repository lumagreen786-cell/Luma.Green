import { ConvexError, type Infer, v } from "convex/values";
import { z } from "zod";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireUser } from "./lib/access";
import { isProfileOpen, openStakeholders } from "./lib/accountClosure";
import { isAdminEmail } from "./lib/admin";
import { findProfile } from "./lib/applicationAccess";
import {
  programmeAggregateFields,
  SERVICE_KINDS,
  vCommercialModel,
  vPaymentDirection,
  vServiceAction,
  vServiceHistory,
  vServiceKind,
  vServiceState,
} from "./lib/serviceRecordsSchema";
import { membershipFor, selectedMembership } from "./lib/workspace";
import { hasWorkspacePermission, workspaceRole } from "./lib/workspaceRoles";
const PAGE = 50;
const MAX_EXACT = 1_000_000_000_000;
const DAY = 86_400_000;
const vEnquiry = v.object({
  id: v.id("serviceEnquiries"),
  commercialModel: vCommercialModel,
  paymentDirection: vPaymentDirection,
  principalParty: v.string(),
  materialSnapshot: v.optional(
    v.object({ materialCode: v.string(), declaredGrams: v.number() }),
  ),
  kind: vServiceKind,
  title: v.string(),
  details: v.string(),
  state: vServiceState,
  version: v.number(),
  recipientId: v.optional(v.id("stakeholderAccounts")),
  orgId: v.optional(v.id("orgs")),
  canEdit: v.boolean(),
  providerStatus: v.literal("unavailable"),
  history: v.array(vServiceHistory),
  canRespond: v.boolean(),
  allowedActions: v.array(vServiceAction),
});
const vProgramme = v.object({
  id: v.id("programmeRecords"),
  title: v.string(),
  evidenceReference: v.string(),
  ...programmeAggregateFields,
  state: v.union(v.literal("draft"), v.literal("closed")),
  version: v.number(),
  orgId: v.optional(v.id("orgs")),
  canEdit: v.boolean(),
});
const vReport = v.object({
  id: v.id("programmeAggregateReports"),
  programmeId: v.id("programmeRecords"),
  purpose: v.string(),
  ...programmeAggregateFields,
  expiresAt: v.number(),
  revokedAt: v.optional(v.number()),
  canRevoke: v.boolean(),
});
const enquiryFields = {
  commercialModel: vCommercialModel,
  principalParty: v.string(),
  materialLotId: v.optional(v.id("materialLots")),
  shareMaterialLotReference: v.boolean(),
  kind: vServiceKind,
  title: v.string(),
  details: v.string(),
  recipientId: v.optional(v.id("stakeholderAccounts")),
  orgId: v.optional(v.id("orgs")),
};
const programmeFields = {
  title: v.string(),
  evidenceReference: v.string(),
  area: v.string(),
  startsOn: v.string(),
  endsOn: v.string(),
  stream: v.string(),
  coverageCount: v.number(),
  trips: v.number(),
  centreHandovers: v.number(),
  quantityGrams: v.number(),
  groupIncomePaise: v.number(),
  orgId: v.optional(v.id("orgs")),
};

function text(value: string, min: number, max: number) {
  const clean = value.trim();
  if (
    clean.length < min ||
    clean.length > max ||
    /\p{Cc}/u.test(clean.replaceAll(/\r?\n/g, ""))
  )
    throw new ConvexError("INVALID_RECORD");
  return clean;
}
function operationKey(value: string) {
  if (!/^[\w-]{8,80}$/.test(value))
    throw new ConvexError("INVALID_OPERATION_KEY");
  return value;
}
function exact(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_EXACT)
    throw new ConvexError("INVALID_QUANTITY");
  return value;
}
async function actor(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  if (!profile) throw new ConvexError("NO_PROFILE");
  return {
    profile,
    isAdmin: isAdminEmail(user.email) && user.twoFactorEnabled === true,
  };
}
async function organization(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  orgId: Id<"orgs"> | undefined,
) {
  if (!orgId) return;
  const selected = await selectedMembership(ctx, profileId);
  if (
    selected?.org._id !== orgId ||
    !hasWorkspacePermission(workspaceRole(selected.membership.role), "operate")
  )
    throw new ConvexError("RECORD_ACCESS_DENIED");
}
async function canOwn(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  row: { requesterProfileId: Id<"profiles">; orgId?: Id<"orgs"> },
) {
  if (
    row.requesterProfileId !== profileId ||
    !(await isProfileOpen(ctx, profileId))
  )
    return false;
  if (!row.orgId) return true;
  const membership = await membershipFor(ctx, profileId, row.orgId),
    org = await ctx.db.get("orgs", row.orgId);
  return (
    Boolean(membership) &&
    (org?.status === "active" || org?.status === "suspended")
  );
}
/** Read ownership survives suspension; writes still need the active selected scope. */
async function canEditOwn(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  row: { requesterProfileId: Id<"profiles">; orgId?: Id<"orgs"> },
) {
  if (!(await canOwn(ctx, profileId, row))) return false;
  if (!row.orgId) return true;
  const selected = await selectedMembership(ctx, profileId);
  return (
    selected?.org._id === row.orgId &&
    hasWorkspacePermission(workspaceRole(selected.membership.role), "operate")
  );
}
async function recipient(
  ctx: QueryCtx,
  id: Id<"stakeholderAccounts"> | undefined,
) {
  if (!id) return;
  const row = await ctx.db.get("stakeholderAccounts", id);
  if (
    row?.status !== "approved" ||
    !(await isProfileOpen(ctx, row.ownerProfileId))
  )
    throw new ConvexError("RECIPIENT_UNAVAILABLE");
  return row;
}
interface ShareSource {
  requesterProfileId: Id<"profiles">;
  orgId?: Id<"orgs">;
}
async function isSourceShareable(ctx: QueryCtx, source: ShareSource) {
  if (!(await isProfileOpen(ctx, source.requesterProfileId))) return false;
  if (!source.orgId) return true;
  const org = await ctx.db.get("orgs", source.orgId);
  return (
    org?.status === "active" &&
    Boolean(await membershipFor(ctx, source.requesterProfileId, source.orgId))
  );
}
async function canReceive(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  row: {
    recipientId?: Id<"stakeholderAccounts">;
    recipientProfileId?: Id<"profiles">;
  },
  source: ShareSource,
) {
  if (
    !row.recipientId ||
    source.requesterProfileId === profileId ||
    row.recipientProfileId !== profileId ||
    !(await isProfileOpen(ctx, profileId)) ||
    !(await isSourceShareable(ctx, source))
  )
    return false;
  const target = await ctx.db.get("stakeholderAccounts", row.recipientId);
  return target?.status === "approved" && target.ownerProfileId === profileId;
}
async function audit(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  table: string,
  id: string,
  action: string,
) {
  await ctx.db.insert("auditLog", {
    actorProfileId: profileId,
    action,
    entityTable: table,
    entityId: id,
    createdAt: Date.now(),
  });
}
function enquiryView(
  row: Doc<"serviceEnquiries">,
  canEdit: boolean,
  canRespond = false,
): Infer<typeof vEnquiry> {
  return {
    id: row._id,
    commercialModel: row.commercialModel,
    paymentDirection: row.paymentDirection,
    principalParty: row.principalParty,
    materialSnapshot: row.materialSnapshot,
    kind: row.kind,
    title: row.title,
    details: row.details,
    state: row.state,
    version: row.version,
    recipientId: row.recipientId,
    orgId: row.orgId,
    canEdit,
    providerStatus: "unavailable",
    history: row.history ?? [],
    canRespond: enquiryActions(row, canEdit, canRespond).includes("respond"),
    allowedActions: enquiryActions(row, canEdit, canRespond),
  };
}

type ServiceAction = Infer<typeof vServiceAction>;
const SERVICE_ACTION_STATES = {
  acknowledge: "acknowledged",
  respond: "responded",
  decline: "declined",
  close: "closed",
} as const satisfies Record<ServiceAction, Infer<typeof vServiceState>>;
function enquiryActions(
  row: Doc<"serviceEnquiries">,
  isOwner: boolean,
  isReceiver: boolean,
): ServiceAction[] {
  if (
    row.state === "draft" ||
    row.state === "closed" ||
    row.state === "declined" ||
    (!isOwner && !isReceiver)
  )
    return [];
  return [
    ...(isReceiver && row.state === "enquiry" ? ["acknowledge" as const] : []),
    "respond",
    ...(isReceiver ? ["decline" as const] : []),
    "close",
  ];
}
function historyEntry(
  row: Doc<"serviceEnquiries">,
  entry: Infer<typeof vServiceHistory>,
) {
  const history = row.history ?? [];
  if (
    history.length >=
    (entry.action === "close" || entry.action === "revoke" ? 100 : 98)
  )
    throw new ConvexError("HISTORY_LIMIT");
  if (
    entry.action !== "close" &&
    entry.action !== "revoke" &&
    history.filter(
      (item) =>
        item.actorProfileId === entry.actorProfileId &&
        item.at > Date.now() - 60_000,
    ).length >= 12
  )
    throw new ConvexError("RESPONSE_RATE_LIMIT");
  if (
    history.reduce((count, item) => count + (item.message?.length ?? 0), 0) +
      (entry.message?.length ?? 0) >
    8000
  )
    throw new ConvexError("HISTORY_LIMIT");
  return [...history, entry];
}

export const actOnEnquiry = mutation({
  args: {
    id: v.id("serviceEnquiries"),
    version: v.number(),
    operationKey: v.string(),
    action: vServiceAction,
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx),
      row = await ctx.db.get("serviceEnquiries", args.id);
    if (!row) throw new ConvexError("RECORD_ACCESS_DENIED");
    const isOwner = await canEditOwn(ctx, profile._id, row),
      isReceiver =
        row.state !== "draft" && (await canReceive(ctx, profile._id, row, row));
    if (!isOwner && !isReceiver) throw new ConvexError("RECORD_ACCESS_DENIED");
    const key = operationKey(args.operationKey),
      message = text(
        args.message ?? "",
        args.action === "respond" ? 1 : 0,
        2000,
      );
    if (message && args.action === "acknowledge")
      throw new ConvexError("INVALID_RECORD");
    const prior = row.history?.find((item) => item.operationKey === key);
    if (prior) {
      if (
        prior.actorProfileId !== profile._id ||
        prior.action !== args.action ||
        (prior.message ?? "") !== message
      )
        throw new ConvexError("OPERATION_KEY_REUSED");
      return null;
    }
    if (
      !Number.isSafeInteger(args.version) ||
      row.version !== args.version ||
      !enquiryActions(row, isOwner, isReceiver).includes(args.action)
    )
      throw new ConvexError("RECORD_CHANGED");
    const state = SERVICE_ACTION_STATES[args.action];
    await ctx.db.patch("serviceEnquiries", row._id, {
      state,
      version: row.version + 1,
      updatedAt: Date.now(),
      history: historyEntry(row, {
        action: args.action,
        party: isOwner ? "requester" : "recipient",
        actorProfileId: profile._id,
        at: Date.now(),
        message: message || undefined,
        operationKey: key,
      }),
    });
    await audit(
      ctx,
      profile._id,
      "serviceEnquiries",
      row._id,
      `service.${args.action}`,
    );
    return null;
  },
});

function programmeView(
  row: Doc<"programmeRecords">,
  canEdit = false,
): Infer<typeof vProgramme> {
  return {
    id: row._id,
    title: row.title,
    evidenceReference: row.evidenceReference,
    area: row.area,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    stream: row.stream,
    coverageCount: row.coverageCount,
    trips: row.trips,
    centreHandovers: row.centreHandovers,
    quantityGrams: row.quantityGrams,
    groupIncomePaise: row.groupIncomePaise,
    sourceQuality: row.sourceQuality,
    state: row.state,
    version: row.version,
    orgId: row.orgId,
    canEdit,
  };
}
function reportView(
  row: Doc<"programmeAggregateReports">,
  canRevoke: boolean,
): Infer<typeof vReport> {
  return {
    id: row._id,
    programmeId: row.programmeId,
    purpose: row.purpose,
    area: row.area,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    stream: row.stream,
    coverageCount: row.coverageCount,
    trips: row.trips,
    centreHandovers: row.centreHandovers,
    quantityGrams: row.quantityGrams,
    groupIncomePaise: row.groupIncomePaise,
    sourceQuality: row.sourceQuality,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    canRevoke,
  };
}
export const board = query({
  args: {},
  returns: v.object({
    orgId: v.union(v.id("orgs"), v.null()),
    canCreate: v.boolean(),
    enquiries: v.array(vEnquiry),
    received: v.array(vEnquiry),
    programmes: v.array(vProgramme),
    reports: v.array(vReport),
    lots: v.array(v.object({ id: v.id("materialLots"), label: v.string() })),
    recipients: v.array(
      v.object({ id: v.id("stakeholderAccounts"), name: v.string() }),
    ),
  }),
  handler: async (ctx) => {
    const who = await actor(ctx);
    const selected = await selectedMembership(ctx, who.profile._id, true);
    const orgId = selected?.org._id ?? null;
    const canCreate =
      !selected ||
      (selected.org.status === "active" &&
        hasWorkspacePermission(
          workspaceRole(selected.membership.role),
          "operate",
        ));
    const own = await ctx.db
      .query("serviceEnquiries")
      .withIndex("by_requester_updated", (q) =>
        q.eq("requesterProfileId", who.profile._id),
      )
      .order("desc")
      .take(PAGE);
    const receivedRows = await ctx.db
      .query("serviceEnquiries")
      .withIndex("by_recipient_updated", (q) =>
        q.eq("recipientProfileId", who.profile._id),
      )
      .order("desc")
      .take(PAGE);
    const programmesRows = await ctx.db
      .query("programmeRecords")
      .withIndex("by_requester_updated", (q) =>
        q.eq("requesterProfileId", who.profile._id),
      )
      .order("desc")
      .take(PAGE);
    const ownReports = await ctx.db
      .query("programmeAggregateReports")
      .withIndex("by_requester_created", (q) =>
        q.eq("requesterProfileId", who.profile._id),
      )
      .order("desc")
      .take(PAGE);
    const receivedReports = await ctx.db
      .query("programmeAggregateReports")
      .withIndex("by_recipient_created", (q) =>
        q.eq("recipientProfileId", who.profile._id),
      )
      .order("desc")
      .take(PAGE);
    const enquiries = await visibleEnquiries(ctx, who.profile._id, own, true),
      received = await visibleEnquiries(
        ctx,
        who.profile._id,
        receivedRows,
        false,
      ),
      programmes = await visibleProgrammes(
        ctx,
        who.profile._id,
        programmesRows,
      ),
      reports = await visibleReports(
        ctx,
        who.profile._id,
        ownReports,
        receivedReports,
      );
    const accounts = await ctx.db
      .query("stakeholderAccounts")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
      .take(PAGE);
    const openAccounts = await openStakeholders(ctx, accounts);
    const materialLots =
      orgId && canCreate
        ? await ctx.db
            .query("materialLots")
            .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
            .order("desc")
            .take(PAGE)
        : [];
    return {
      lots: materialLots.map((lot) => ({
        id: lot._id,
        label: lot.materialCode,
      })),
      orgId,
      canCreate,
      enquiries,
      received,
      programmes,
      reports,
      recipients: openAccounts.map((row) => ({
        id: row._id,
        name: row.organizationName,
      })),
    };
  },
});
const MODEL_DIRECTIONS: Record<
  Infer<typeof vCommercialModel>,
  Infer<typeof vPaymentDirection>
> = {
  partner_service: "not_applicable",
  materials_sale_reference: "buyer_to_seller",
  toll_jobwork: "principal_to_processor",
  paid_collection: "customer_to_service",
  generator_paid_treatment: "generator_to_handler",
};
/** Hash normalized client fields only; saved edits and source snapshots are excluded. */
async function creationFingerprint(
  payload: Record<string, string | number | boolean | undefined>,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ version: 1, ...payload }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
async function materialReference(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  orgId: Id<"orgs"> | undefined,
  lotId: Id<"materialLots"> | undefined,
  canShare: boolean,
) {
  if (!lotId) return;
  if (!orgId) throw new ConvexError("RECORD_ACCESS_DENIED");
  await organization(ctx, profileId, orgId);
  const lot = await ctx.db.get("materialLots", lotId);
  if (lot?.orgId !== orgId) throw new ConvexError("RECORD_ACCESS_DENIED");
  return canShare
    ? { materialCode: lot.materialCode, declaredGrams: lot.availableGrams }
    : undefined;
}
// eslint-disable-next-line unicorn/no-non-function-verb-prefix -- Convex exposes this registered mutation under its contract name.
export const createEnquiry = mutation({
  args: {
    operationKey: v.string(),
    submit: v.optional(v.boolean()),
    ...enquiryFields,
  },
  returns: v.id("serviceEnquiries"),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx);
    await organization(ctx, profile._id, args.orgId);
    const target = await recipient(ctx, args.recipientId);
    const key = operationKey(args.operationKey);
    const payload = {
      commercialModel: args.commercialModel,
      principalParty: text(
        args.principalParty,
        args.commercialModel === "toll_jobwork" ? 3 : 0,
        120,
      ),
      materialLotId: args.materialLotId,
      shareMaterialLotReference: args.shareMaterialLotReference,
      kind: args.kind,
      title: text(args.title, 3, 120),
      details: text(args.details, 5, 2000),
      orgId: args.orgId,
      recipientId: args.recipientId,
      submit: args.submit ?? false,
    };
    const fingerprint = await creationFingerprint(payload);
    const existing = await ctx.db
      .query("serviceEnquiries")
      .withIndex("by_requester_operation", (q) =>
        q.eq("requesterProfileId", profile._id).eq("operationKey", key),
      )
      .unique();
    if (existing) {
      if (existing.creationFingerprint !== fingerprint)
        throw new ConvexError("OPERATION_KEY_REUSED");
      return existing._id;
    }
    const snapshot = await materialReference(
      ctx,
      profile._id,
      args.orgId,
      args.materialLotId,
      args.shareMaterialLotReference,
    );
    const values = {
      commercialModel: payload.commercialModel,
      paymentDirection: MODEL_DIRECTIONS[payload.commercialModel],
      principalParty: payload.principalParty,
      materialLotId: payload.materialLotId,
      materialSnapshot: snapshot,
      kind: payload.kind,
      title: payload.title,
      details: payload.details,
      orgId: payload.orgId,
      recipientId: payload.recipientId,
    };
    const now = Date.now();
    const id = await ctx.db.insert("serviceEnquiries", {
      ...values,
      creationFingerprint: fingerprint,
      recipientProfileId: target?.ownerProfileId,
      operationKey: key,
      requesterProfileId: profile._id,
      submittedOnCreate: args.submit ?? false,
      state: args.submit ? "enquiry" : "draft",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, profile._id, "serviceEnquiries", id, "service.created");
    return id;
  },
});
export const updateEnquiry = mutation({
  args: {
    id: v.id("serviceEnquiries"),
    version: v.number(),
    title: v.string(),
    details: v.string(),
    state: vServiceState,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx);
    const row = await ctx.db.get("serviceEnquiries", args.id);
    if (!row || !(await canOwn(ctx, profile._id, row)))
      throw new ConvexError("RECORD_ACCESS_DENIED");
    await organization(ctx, profile._id, row.orgId);
    if (
      row.version !== args.version ||
      row.state === "closed" ||
      row.state === "declined" ||
      (row.state === "draft" &&
        !["draft", "enquiry", "closed"].includes(args.state)) ||
      (row.state !== "draft" &&
        (args.state !== "closed" ||
          args.title !== row.title ||
          args.details !== row.details))
    )
      throw new ConvexError("RECORD_CHANGED");
    if (args.state === "enquiry") await recipient(ctx, row.recipientId);
    const editAction = args.state === "enquiry" ? "submit" : "edit";
    await ctx.db.patch("serviceEnquiries", row._id, {
      title: text(args.title, 3, 120),
      details: text(args.details, 5, 2000),
      history: historyEntry(row, {
        action: args.state === "closed" ? "close" : editAction,
        party: "requester",
        actorProfileId: profile._id,
        at: Date.now(),
      }),
      state: args.state,
      version: row.version + 1,
      updatedAt: Date.now(),
    });
    await audit(
      ctx,
      profile._id,
      "serviceEnquiries",
      row._id,
      "service.updated",
    );
    return null;
  },
});
const _vProgrammeInput = v.object(programmeFields);
type ProgrammeInput = Infer<typeof _vProgrammeInput>;
function programmeValues(args: ProgrammeInput) {
  if (
    !z.iso.date().safeParse(args.startsOn).success ||
    !z.iso.date().safeParse(args.endsOn).success ||
    args.startsOn > args.endsOn ||
    Date.parse(args.endsOn) - Date.parse(args.startsOn) > 3660 * DAY
  )
    throw new ConvexError("INVALID_PERIOD");
  return {
    title: text(args.title, 3, 120),
    evidenceReference: text(args.evidenceReference, 0, 500),
    area: text(args.area, 2, 120),
    startsOn: args.startsOn,
    endsOn: args.endsOn,
    stream: text(args.stream, 2, 80),
    coverageCount: exact(args.coverageCount),
    trips: exact(args.trips),
    centreHandovers: exact(args.centreHandovers),
    quantityGrams: exact(args.quantityGrams),
    groupIncomePaise: exact(args.groupIncomePaise),
    orgId: args.orgId,
    sourceQuality: "reported_unverified" as const,
  };
}
// eslint-disable-next-line unicorn/no-non-function-verb-prefix -- Convex exposes this registered mutation under its contract name.
export const createProgramme = mutation({
  args: { operationKey: v.string(), ...programmeFields },
  returns: v.id("programmeRecords"),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx);
    await organization(ctx, profile._id, args.orgId);
    const values = programmeValues(args),
      key = operationKey(args.operationKey),
      fingerprint = await creationFingerprint({
        title: values.title,
        evidenceReference: values.evidenceReference,
        area: values.area,
        startsOn: values.startsOn,
        endsOn: values.endsOn,
        stream: values.stream,
        coverageCount: values.coverageCount,
        trips: values.trips,
        centreHandovers: values.centreHandovers,
        quantityGrams: values.quantityGrams,
        groupIncomePaise: values.groupIncomePaise,
        orgId: values.orgId,
      });
    const existing = await ctx.db
      .query("programmeRecords")
      .withIndex("by_requester_operation", (q) =>
        q.eq("requesterProfileId", profile._id).eq("operationKey", key),
      )
      .unique();
    if (existing) {
      if (existing.creationFingerprint !== fingerprint)
        throw new ConvexError("OPERATION_KEY_REUSED");
      return existing._id;
    }
    const now = Date.now(),
      id = await ctx.db.insert("programmeRecords", {
        ...values,
        creationFingerprint: fingerprint,
        requesterProfileId: profile._id,
        operationKey: key,
        state: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
    await audit(ctx, profile._id, "programmeRecords", id, "programme.created");
    return id;
  },
});
export const updateProgramme = mutation({
  args: {
    id: v.id("programmeRecords"),
    version: v.number(),
    state: v.union(v.literal("draft"), v.literal("closed")),
    ...programmeFields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx);
    const row = await ctx.db.get("programmeRecords", args.id);
    if (!row || !(await canOwn(ctx, profile._id, row)))
      throw new ConvexError("RECORD_ACCESS_DENIED");
    await organization(ctx, profile._id, row.orgId);
    if (
      row.orgId !== args.orgId ||
      row.version !== args.version ||
      row.state === "closed"
    )
      throw new ConvexError("RECORD_CHANGED");
    await ctx.db.patch("programmeRecords", row._id, {
      ...programmeValues(args),
      state: args.state,
      version: row.version + 1,
      updatedAt: Date.now(),
    });
    await audit(
      ctx,
      profile._id,
      "programmeRecords",
      row._id,
      "programme.updated",
    );
    return null;
  },
});
function aggregateValues(row: Doc<"programmeRecords">) {
  return {
    area: row.area,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    stream: row.stream,
    coverageCount: row.coverageCount,
    trips: row.trips,
    centreHandovers: row.centreHandovers,
    quantityGrams: row.quantityGrams,
    groupIncomePaise: row.groupIncomePaise,
    sourceQuality: row.sourceQuality,
  };
}
export const shareProgramme = mutation({
  args: {
    programmeId: v.id("programmeRecords"),
    recipientId: v.id("stakeholderAccounts"),
    operationKey: v.string(),
    purpose: v.string(),
    expiresAt: v.number(),
  },
  returns: v.id("programmeAggregateReports"),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx);
    const row = await ctx.db.get("programmeRecords", args.programmeId);
    if (!row || !(await canOwn(ctx, profile._id, row)))
      throw new ConvexError("RECORD_ACCESS_DENIED");
    await organization(ctx, profile._id, row.orgId);
    const target = await recipient(ctx, args.recipientId);
    if (!target) throw new ConvexError("RECIPIENT_UNAVAILABLE");
    const now = Date.now(),
      key = operationKey(args.operationKey),
      purpose = text(args.purpose, 3, 200);
    if (
      !Number.isSafeInteger(args.expiresAt) ||
      args.expiresAt <= now ||
      args.expiresAt > now + 90 * DAY
    )
      throw new ConvexError("INVALID_EXPIRY");
    const existing = await ctx.db
      .query("programmeAggregateReports")
      .withIndex("by_requester_operation", (q) =>
        q.eq("requesterProfileId", profile._id).eq("operationKey", key),
      )
      .unique();
    if (existing) {
      if (
        existing.programmeId !== row._id ||
        existing.recipientId !== target._id ||
        existing.purpose !== purpose ||
        existing.expiresAt !== args.expiresAt
      )
        throw new ConvexError("OPERATION_KEY_REUSED");
      return existing._id;
    }
    const id = await ctx.db.insert("programmeAggregateReports", {
      ...aggregateValues(row),
      requesterProfileId: profile._id,
      programmeId: row._id,
      recipientId: target._id,
      recipientProfileId: target.ownerProfileId,
      operationKey: key,
      purpose,
      expiresAt: args.expiresAt,
      createdAt: now,
    });
    await audit(
      ctx,
      profile._id,
      "programmeAggregateReports",
      id,
      "programme.shared",
    );
    return id;
  },
});
export const revokeProgrammeShare = mutation({
  args: { id: v.id("programmeAggregateReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx);
    const row = await ctx.db.get("programmeAggregateReports", args.id);
    if (row?.requesterProfileId !== profile._id)
      throw new ConvexError("RECORD_ACCESS_DENIED");
    const source = await ctx.db.get("programmeRecords", row.programmeId);
    if (!source || !(await canOwn(ctx, profile._id, source)))
      throw new ConvexError("RECORD_ACCESS_DENIED");
    await organization(ctx, profile._id, source.orgId);
    if (row.revokedAt !== undefined) return null;
    await ctx.db.patch("programmeAggregateReports", row._id, {
      revokedAt: Date.now(),
    });
    await audit(
      ctx,
      profile._id,
      "programmeAggregateReports",
      row._id,
      "programme.share_revoked",
    );
    return null;
  },
});
export async function canReadProgrammeReport(
  ctx: QueryCtx,
  row: Doc<"programmeAggregateReports">,
  profileId: Id<"profiles">,
  isOwner: boolean,
) {
  const source = await ctx.db.get("programmeRecords", row.programmeId);
  if (!source) return false;
  return isOwner
    ? canOwn(ctx, profileId, source)
    : row.revokedAt === undefined &&
        row.expiresAt > Date.now() &&
        (await canReceive(ctx, profileId, row, source));
}
export const enquiry = query({
  args: { id: v.id("serviceEnquiries") },
  returns: vEnquiry,
  handler: async (ctx, args) => {
    const who = await actor(ctx),
      row = await ctx.db.get("serviceEnquiries", args.id);
    if (!row) throw new ConvexError("RECORD_ACCESS_DENIED");
    const isOwn = await canOwn(ctx, who.profile._id, row);
    if (
      !isOwn &&
      !who.isAdmin &&
      (row.state === "draft" ||
        !(await canReceive(ctx, who.profile._id, row, row)))
    )
      throw new ConvexError("RECORD_ACCESS_DENIED");
    return enquiryView(
      row,
      await canEditOwn(ctx, who.profile._id, row),
      row.state !== "draft" &&
        (await canReceive(ctx, who.profile._id, row, row)),
    );
  },
});
export const programme = query({
  args: { id: v.id("programmeRecords") },
  returns: vProgramme,
  handler: async (ctx, args) => {
    const who = await actor(ctx),
      row = await ctx.db.get("programmeRecords", args.id);
    if (!row || (!who.isAdmin && !(await canOwn(ctx, who.profile._id, row))))
      throw new ConvexError("RECORD_ACCESS_DENIED");
    return programmeView(row, await canEditOwn(ctx, who.profile._id, row));
  },
});
export const report = query({
  args: { id: v.id("programmeAggregateReports") },
  returns: vReport,
  handler: async (ctx, args) => {
    const who = await actor(ctx),
      row = await ctx.db.get("programmeAggregateReports", args.id);
    if (!row) throw new ConvexError("RECORD_ACCESS_DENIED");
    const isOwn = await canReadProgrammeReport(ctx, row, who.profile._id, true);
    if (
      !isOwn &&
      !who.isAdmin &&
      !(await canReadProgrammeReport(ctx, row, who.profile._id, false))
    )
      throw new ConvexError("RECORD_ACCESS_DENIED");
    const source = await ctx.db.get("programmeRecords", row.programmeId);
    return reportView(
      row,
      Boolean(source && (await canEditOwn(ctx, who.profile._id, source))),
    );
  },
});
export const seedReferenceKinds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let added = 0;
    for (const code of SERVICE_KINDS) {
      const existing = await ctx.db
        .query("serviceKindDefinitions")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (existing) {
        continue;
      }

      const definitionId = await ctx.db.insert("serviceKindDefinitions", {
        code,
        nameKey: `serviceRecords.kinds.${code}`,
        active: true,
      });
      await ctx.db.insert("auditLog", {
        action: "service.reference_defined",
        entityTable: "serviceKindDefinitions",
        entityId: definitionId,
        metadata: { code, source: "reference_initializer" },
        createdAt: Date.now(),
      });
      added++;
    }
    return added;
  },
});

async function visibleEnquiries(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  rows: Doc<"serviceEnquiries">[],
  isOwner: boolean,
) {
  const result: Infer<typeof vEnquiry>[] = [];
  for (const row of rows) {
    const canRead = isOwner
      ? await canOwn(ctx, profileId, row)
      : row.state !== "draft" && (await canReceive(ctx, profileId, row, row));
    if (canRead)
      result.push(
        enquiryView(
          row,
          isOwner && (await canEditOwn(ctx, profileId, row)),
          !isOwner,
        ),
      );
  }
  return result;
}
async function visibleProgrammes(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  rows: Doc<"programmeRecords">[],
) {
  const result: Infer<typeof vProgramme>[] = [];
  for (const row of rows)
    if (await canOwn(ctx, profileId, row))
      result.push(programmeView(row, await canEditOwn(ctx, profileId, row)));
  return result;
}
async function visibleReports(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  own: Doc<"programmeAggregateReports">[],
  received: Doc<"programmeAggregateReports">[],
) {
  const result: Infer<typeof vReport>[] = [];
  for (const row of own)
    if (await canReadProgrammeReport(ctx, row, profileId, true)) {
      const source = await ctx.db.get("programmeRecords", row.programmeId);
      result.push(
        reportView(
          row,
          Boolean(source && (await canEditOwn(ctx, profileId, source))),
        ),
      );
    }
  for (const row of received)
    if (
      result.every((item) => item.id !== row._id) &&
      (await canReadProgrammeReport(ctx, row, profileId, false))
    )
      result.push(reportView(row, false));
  return result;
}

export const revokeEnquiryRecipient = mutation({
  args: { id: v.id("serviceEnquiries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await actor(ctx);
    const row = await ctx.db.get("serviceEnquiries", args.id);
    if (!row || !(await canOwn(ctx, profile._id, row)))
      throw new ConvexError("RECORD_ACCESS_DENIED");
    await organization(ctx, profile._id, row.orgId);
    if (!row.recipientId) return null;
    await ctx.db.patch("serviceEnquiries", row._id, {
      recipientId: undefined,
      recipientProfileId: undefined,
      history: historyEntry(row, {
        action: "revoke",
        party: "requester",
        actorProfileId: profile._id,
        at: Date.now(),
      }),
      version: row.version + 1,
      updatedAt: Date.now(),
    });
    await audit(
      ctx,
      profile._id,
      "serviceEnquiries",
      row._id,
      "service.recipient_revoked",
    );
    return null;
  },
});
type SupportServiceSource =
  | { kind: "serviceEnquiry"; id: Id<"serviceEnquiries"> }
  | { kind: "programme"; id: Id<"programmeRecords"> };
export async function canAccessServiceSource(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
  source: SupportServiceSource,
): Promise<boolean> {
  if (source.kind === "programme") {
    const row = await ctx.db.get("programmeRecords", source.id);
    return Boolean(row && (await canOwn(ctx, profileId, row)));
  }
  const row = await ctx.db.get("serviceEnquiries", source.id);
  return row
    ? (await canOwn(ctx, profileId, row)) ||
        (row.state !== "draft" && (await canReceive(ctx, profileId, row, row)))
    : false;
}
export async function serviceSupportSources(
  ctx: QueryCtx,
  profileId: Id<"profiles">,
): Promise<{ source: SupportServiceSource; label: string }[]> {
  const enquiries = await ctx.db
      .query("serviceEnquiries")
      .withIndex("by_requester_updated", (q) =>
        q.eq("requesterProfileId", profileId),
      )
      .order("desc")
      .take(10),
    received = await ctx.db
      .query("serviceEnquiries")
      .withIndex("by_recipient_updated", (q) =>
        q.eq("recipientProfileId", profileId),
      )
      .order("desc")
      .take(10),
    programmes = await ctx.db
      .query("programmeRecords")
      .withIndex("by_requester_updated", (q) =>
        q.eq("requesterProfileId", profileId),
      )
      .order("desc")
      .take(10);
  const result: { source: SupportServiceSource; label: string }[] = [];
  for (const row of [...enquiries, ...received]) {
    const source = { kind: "serviceEnquiry" as const, id: row._id };
    if (
      (await canAccessServiceSource(ctx, profileId, source)) &&
      result.every((item) => item.source.id !== row._id)
    )
      result.push({ source, label: row.title });
  }
  for (const row of programmes) {
    const source = { kind: "programme" as const, id: row._id };
    if (await canAccessServiceSource(ctx, profileId, source))
      result.push({ source, label: row.title });
  }
  return result;
}

export const adminList = query({
  args: {},
  returns: v.object({
    enquiries: v.array(vEnquiry),
    programmes: v.array(vProgramme),
  }),
  handler: async (ctx) => {
    const who = await actor(ctx);
    if (!who.isAdmin) throw new ConvexError("NOT_ADMIN");
    const enquiries = await ctx.db
        .query("serviceEnquiries")
        .withIndex("by_creation_time")
        .order("desc")
        .take(PAGE),
      programmes = await ctx.db
        .query("programmeRecords")
        .withIndex("by_creation_time")
        .order("desc")
        .take(PAGE);
    return {
      enquiries: enquiries.map((row) => enquiryView(row, false)),
      programmes: programmes.map((row) => programmeView(row)),
    };
  },
});

/** One short transactional scheduler owns draft cleanup; published evidence stays. */
export const expireDrafts = internalMutation({
  args: {
    kind: v.optional(
      v.union(v.literal("serviceEnquiry"), v.literal("programme")),
    ),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const kind = args.kind ?? "serviceEnquiry",
      cutoff = Date.now() - 30 * DAY;
    const table =
      kind === "serviceEnquiry" ? "serviceEnquiries" : "programmeRecords";
    const result = await ctx.db
      .query(table)
      .withIndex("by_state_updated", (q) =>
        q.eq("state", "draft").lt("updatedAt", cutoff),
      )
      .paginate({ cursor: args.cursor ?? null, numItems: 100 });
    let removed = 0;
    for (const row of result.page) {
      const source =
        kind === "serviceEnquiry"
          ? {
              kind: "serviceEnquiry" as const,
              id: row._id as Id<"serviceEnquiries">,
            }
          : {
              kind: "programme" as const,
              id: row._id as Id<"programmeRecords">,
            };
      const issues = await ctx.db
        .query("supportRequests")
        .withIndex("by_source", (q) => q.eq("source", source))
        .take(100);
      if (
        issues.length === 100 ||
        issues.some((issue) => issue.status === "open")
      )
        continue;
      if (kind === "programme") {
        const report = await ctx.db
          .query("programmeAggregateReports")
          .withIndex("by_programme", (q) =>
            q.eq("programmeId", row._id as Id<"programmeRecords">),
          )
          .first();
        if (report) continue;
      }
      await ctx.db.delete(table, row._id);
      await ctx.db.insert("auditLog", {
        action: "service.draft_expired",
        entityTable: table,
        entityId: row._id,
        createdAt: Date.now(),
      });
      removed++;
    }
    if (!result.isDone)
      await ctx.scheduler.runAfter(0, internal.services.expireDrafts, {
        kind,
        cursor: result.continueCursor,
      });
    else if (kind === "serviceEnquiry")
      await ctx.scheduler.runAfter(0, internal.services.expireDrafts, {
        kind: "programme",
      });
    return removed;
  },
});
