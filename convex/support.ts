import type { Infer } from "convex/values";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { canAccessRecord } from "./lib/collaboration";
import { vSupportSource, vSupportTeam } from "./lib/collectionOperationsSchema";
import { normalizeIndianMobile } from "./lib/phone";
import {
  currentProfile,
  membershipFor,
  selectedMembership,
} from "./lib/workspace";
import { canAccessServiceSource, serviceSupportSources } from "./services";
const SUPPORT_HOUR_MS = 60 * 60 * 1000;
const SUPPORT_HOURLY_LIMIT = 3;

const TOPICS = [
  "account",
  "pickup",
  "prices",
  "payments",
  "documents",
  "trade",
  "solar",
  "other",
] as const;

const vTopic = v.union(
  v.literal("account"),
  v.literal("pickup"),
  v.literal("prices"),
  v.literal("payments"),
  v.literal("documents"),
  v.literal("trade"),
  v.literal("solar"),
  v.literal("other"),
);

const vRole = v.union(
  v.literal("household"),
  v.literal("kabadiwala"),
  v.literal("yard"),
  v.literal("recycler"),
  v.literal("manufacturer"),
  v.literal("saathi"),
  v.literal("other"),
);

/**
 * A message to the team from the help centre or the solar page. Open to
 * anyone — people who can't sign in are the ones who most need to ask.
 */
export const send = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    role: vRole,
    topic: vTopic,
    message: v.string(),
    source: v.optional(vSupportSource),
    safetyIssue: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError("INVALID_NAME");
    }
    const phone = normalizeIndianMobile(args.phone);
    if (!phone) throw new ConvexError("INVALID_PHONE");
    const message = args.message.trim();
    if (message.length < 5 || message.length > 1000) {
      throw new ConvexError("INVALID_MESSAGE");
    }
    const now = Date.now();
    const recent = await ctx.db
      .query("supportRequests")
      .withIndex("by_phone_createdAt", (q) =>
        q.eq("phone", phone).gt("createdAt", now - SUPPORT_HOUR_MS),
      )
      .take(SUPPORT_HOURLY_LIMIT);
    const profile = await currentProfile(ctx);
    if (
      args.source &&
      (!profile ||
        !(await canAccessSupportSource(ctx, args.source, profile._id)))
    )
      throw new ConvexError("RECORD_ACCESS_DENIED");
    const teams: Partial<
      Record<string, "operations" | "accounts" | "reviewer">
    > = { payments: "accounts", documents: "reviewer" };
    const team = teams[args.topic] ?? "operations";
    if (args.source) {
      const linked = await ctx.db
        .query("supportRequests")
        .withIndex("by_source", (q) => q.eq("source", args.source))
        .take(100);
      const existing = linked.find(
        (r) => r.profileId === profile?._id && r.status === "open",
      );
      if (existing)
        return appendSupportUpdate(ctx, existing, {
          message,
          isUrgent: args.topic === "payments" || args.safetyIssue === true,
          team,
          profileId: profile?._id,
          now,
        });
    }
    if (recent.length >= SUPPORT_HOURLY_LIMIT)
      throw new ConvexError("SUPPORT_RATE_LIMITED");
    const requestId = await ctx.db.insert("supportRequests", {
      profileId: profile?._id,
      source: args.source,
      team,
      escalatedAt:
        args.topic === "payments" || args.safetyIssue ? now : undefined,
      name,
      phone,
      role: args.role,
      topic: args.topic,
      message,
      status: "open",
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorProfileId: profile?._id,
      action: "support.created",
      entityTable: "supportRequests",
      entityId: requestId,
      createdAt: now,
    });
    return null;
  },
});

/** The admin's inbox, newest first. */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("supportRequests"),
      name: v.string(),
      phone: v.string(),
      role: v.string(),
      topic: v.string(),
      message: v.string(),
      status: v.union(v.literal("open"), v.literal("answered")),
      createdAt: v.number(),
      source: v.optional(vSupportSource),
      team: v.optional(vSupportTeam),
      acknowledgedAt: v.optional(v.number()),
      escalatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("supportRequests").order("desc").take(200);
    return rows.map((row) => ({
      id: row._id,
      name: row.name,
      phone: row.phone,
      role: row.role,
      topic: row.topic,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt,
      ...(row.source && { source: row.source }),
      ...(row.team && { team: row.team }),
      ...(row.acknowledgedAt !== undefined && {
        acknowledgedAt: row.acknowledgedAt,
      }),
      ...(row.escalatedAt !== undefined && { escalatedAt: row.escalatedAt }),
    }));
  },
});

export const markAnswered = mutation({
  args: { id: v.id("supportRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get("supportRequests", args.id);
    if (!row) throw new ConvexError("NOT_FOUND");
    if (row.status === "answered") return null;
    const profile = await currentProfile(ctx);
    await ctx.db.patch("supportRequests", args.id, { status: "answered" });
    await ctx.db.insert("auditLog", {
      actorProfileId: profile?._id,
      action: "support.answered",
      entityTable: "supportRequests",
      entityId: args.id,
      createdAt: Date.now(),
    });
    return null;
  },
});

export { TOPICS as SUPPORT_TOPICS };

async function canAccessSupportSource(
  ctx: QueryCtx,
  source: Infer<typeof vSupportSource>,
  profileId: Id<"profiles">,
): Promise<boolean> {
  switch (source.kind) {
    case "serviceEnquiry":
    case "programme": {
      return canAccessServiceSource(ctx, profileId, source);
    }
    case "materialLot":
    case "inspection":
    case "materialDemand": {
      let row;
      switch (source.kind) {
        case "materialLot": {
          row = await ctx.db.get("materialLots", source.id);
          break;
        }
        case "inspection": {
          row = await ctx.db.get("lotInspections", source.id);
          break;
        }
        case "materialDemand": {
          row = await ctx.db.get("materialDemands", source.id);
          break;
        }
      }
      if (!row) return false;
      const membership = await membershipFor(ctx, profileId, row.orgId);
      const org = await ctx.db.get("orgs", row.orgId);
      return Boolean(membership) && org?.status === "active";
    }
    case "application": {
      const row = await ctx.db.get("applications", source.id);
      return row?.profileId === profileId;
    }
    case "booking": {
      const row = await ctx.db.get("bookings", source.id);
      return row
        ? row.householdProfileId === profileId ||
            (await canAccessRecord(
              ctx,
              { kind: "workspace", id: row.orgId },
              source,
              profileId,
            ))
        : false;
    }
    case "job": {
      const row = await ctx.db.get("jobs", source.id);
      return row?.orgId
        ? canAccessRecord(
            ctx,
            { kind: "workspace", id: row.orgId },
            source,
            profileId,
          )
        : false;
    }
    case "trade": {
      const row = await ctx.db.get("trades", source.id);
      return row
        ? (await canAccessRecord(
            ctx,
            { kind: "workspace", id: row.buyerOrgId },
            source,
            profileId,
          )) ||
            (await canAccessRecord(
              ctx,
              { kind: "workspace", id: row.sellerOrgId },
              source,
              profileId,
            ))
        : false;
    }
  }
}
export const triage = mutation({
  args: {
    id: v.id("supportRequests"),
    team: vSupportTeam,
    escalate: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get("supportRequests", args.id);
    if (!row) throw new ConvexError("NOT_FOUND");
    const now = Date.now();
    await ctx.db.patch("supportRequests", row._id, {
      team: args.team,
      acknowledgedAt: row.acknowledgedAt ?? now,
      escalatedAt: args.escalate ? (row.escalatedAt ?? now) : row.escalatedAt,
    });
    await ctx.db.insert("auditLog", {
      action: "support.triaged",
      entityTable: "supportRequests",
      entityId: row._id,
      metadata: { team: args.team, escalated: args.escalate },
      createdAt: now,
    });
    return null;
  },
});

export const linkedSources = query({
  args: {},
  returns: v.array(v.object({ source: vSupportSource, label: v.string() })),
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);
    if (!profile) return [];
    const sources: { source: Infer<typeof vSupportSource>; label: string }[] =
      [];
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_household", (q) => q.eq("householdProfileId", profile._id))
      .order("desc")
      .take(10);
    for (const row of bookings)
      sources.push({
        source: { kind: "booking", id: row._id },
        label: row.slotDate,
      });
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .take(10);
    for (const row of apps)
      sources.push({
        source: { kind: "application", id: row._id },
        label: row.kind,
      });
    const selected = await selectedMembership(ctx, profile._id);
    if (selected) {
      const orgId = selected.org._id;
      const buying = await ctx.db
        .query("trades")
        .withIndex("by_buyer", (q) => q.eq("buyerOrgId", orgId))
        .order("desc")
        .take(10);
      const selling = await ctx.db
        .query("trades")
        .withIndex("by_seller", (q) => q.eq("sellerOrgId", orgId))
        .order("desc")
        .take(10);
      const trades = new Map(
        [...buying, ...selling].map((row) => [row._id, row]),
      );
      for (const row of trades.values())
        sources.push({
          source: { kind: "trade", id: row._id },
          label: row.materialCode,
        });
      const lots = await ctx.db
        .query("materialLots")
        .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(10);
      for (const row of lots)
        sources.push({
          source: { kind: "materialLot", id: row._id },
          label: row.materialCode,
        });
      const inspections = await ctx.db
        .query("lotInspections")
        .withIndex("by_org_created", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(10);
      for (const row of inspections)
        sources.push({
          source: { kind: "inspection", id: row._id },
          label: new Date(row.createdAt).toISOString().slice(0, 10),
        });
      const demands = await ctx.db
        .query("materialDemands")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(10);
      for (const row of demands)
        sources.push({
          source: { kind: "materialDemand", id: row._id },
          label: row.materialCode,
        });
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(10);
      for (const row of jobs)
        sources.push({
          source: { kind: "job", id: row._id },
          label: row.title,
        });
    }
    sources.push(...(await serviceSupportSources(ctx, profile._id)));
    return sources;
  },
});

export const updates = query({
  args: { id: v.id("supportRequests") },
  returns: v.array(
    v.object({
      message: v.string(),
      urgent: v.boolean(),
      team: vSupportTeam,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("supportUpdates")
      .withIndex("by_request_created", (q) => q.eq("requestId", args.id))
      .order("desc")
      .take(100);
    return rows.map((row) => ({
      message: row.message,
      urgent: row.urgent,
      team: row.team,
      createdAt: row.createdAt,
    }));
  },
});

async function appendSupportUpdate(
  ctx: MutationCtx,
  existing: Doc<"supportRequests">,
  input: {
    message: string;
    isUrgent: boolean;
    team: Infer<typeof vSupportTeam>;
    profileId: Id<"profiles"> | undefined;
    now: number;
  },
): Promise<null> {
  const previous = await ctx.db
    .query("supportUpdates")
    .withIndex("by_request_message_urgent_team", (q) =>
      q
        .eq("requestId", existing._id)
        .eq("message", input.message)
        .eq("urgent", input.isUrgent)
        .eq("team", input.team),
    )
    .unique();
  if (!previous) {
    await ctx.db.insert("supportUpdates", {
      requestId: existing._id,
      actorProfileId: input.profileId,
      message: input.message,
      urgent: input.isUrgent,
      team: input.team,
      createdAt: input.now,
    });
    await ctx.db.insert("auditLog", {
      actorProfileId: input.profileId,
      action: input.isUrgent ? "support.escalated" : "support.updated",
      entityTable: "supportRequests",
      entityId: existing._id,
      createdAt: input.now,
    });
  }
  if (input.isUrgent)
    await ctx.db.patch("supportRequests", existing._id, {
      team: input.team,
      escalatedAt: existing.escalatedAt ?? input.now,
    });
  return null;
}

/** Receipt disputes use the same private linked case and update history. */
export async function collectionPaymentIssue(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  profileId: Id<"profiles">,
  phone: string,
  message: string,
): Promise<void> {
  const source = { kind: "booking" as const, id: booking._id };
  const now = Date.now();
  const cases = await ctx.db
    .query("supportRequests")
    .withIndex("by_source", (q) => q.eq("source", source))
    .take(100);
  const existing = cases.find(
    (row) => row.profileId === profileId && row.status === "open",
  );
  if (existing) {
    await appendSupportUpdate(ctx, existing, {
      message,
      isUrgent: true,
      team: "accounts",
      profileId,
      now,
    });
    return;
  }
  const requestId = await ctx.db.insert("supportRequests", {
    source,
    profileId,
    name: booking.name ?? "Household",
    phone,
    role: "household",
    topic: "payments",
    message,
    team: "accounts",
    escalatedAt: now,
    status: "open",
    createdAt: now,
  });
  await ctx.db.insert("auditLog", {
    actorProfileId: profileId,
    action: "support.created",
    entityTable: "supportRequests",
    entityId: requestId,
    createdAt: now,
  });
}
