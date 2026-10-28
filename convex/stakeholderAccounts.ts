import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { isProfileOpen, openStakeholders } from "./lib/accountClosure";
import { findProfile, requireMember } from "./lib/applicationAccess";
import { vSiteType } from "./lib/siteClassification";
import {
  isGeneratorSiteType,
  organizationNameOrNull,
  vStakeholderKind,
  vStakeholderStatus,
} from "./lib/stakeholderKinds";

const vAccountId = v.id("stakeholderAccounts");
const vSelfView = v.object({
  id: vAccountId,
  kind: vStakeholderKind,
  siteType: v.optional(vSiteType),
  organizationName: v.string(),
  status: vStakeholderStatus,
  requestedAt: v.number(),
  reviewedAt: v.optional(v.number()),
  reviewNote: v.optional(v.string()),
});

/** One application per member. Repeating an identical request is safe. */
export const request = mutation({
  args: {
    kind: vStakeholderKind,
    siteType: v.optional(vSiteType),
    organizationName: v.string(),
    ageConfirmed: v.literal(true),
    privacyAccepted: v.literal(true),
  },
  returns: vAccountId,
  handler: async (ctx, args) => {
    const profile = await requireMember(ctx);
    const name = organizationNameOrNull(args.organizationName);
    if (!name) throw new ConvexError("INVALID_ORGANIZATION_NAME");
    if (
      args.kind === "material_generator"
        ? !isGeneratorSiteType(args.siteType)
        : args.siteType !== undefined
    ) {
      throw new ConvexError("INVALID_SITE_TYPE");
    }
    const existing = await ctx.db
      .query("stakeholderAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .unique();
    if (existing) {
      if (
        existing.kind === args.kind &&
        existing.siteType === args.siteType &&
        existing.organizationName === name
      ) {
        return existing._id;
      }
      throw new ConvexError("ALREADY_REQUESTED");
    }

    const now = Date.now();
    const id = await ctx.db.insert("stakeholderAccounts", {
      ownerProfileId: profile._id,
      ageConfirmedAt: now,
      privacyAcceptedAt: now,
      kind: args.kind,
      siteType: args.siteType,
      organizationName: name,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      action: "stakeholder.requested",
      entityTable: "stakeholderAccounts",
      entityId: id,
      actorProfileId: profile._id,
      metadata: { kind: args.kind, siteType: args.siteType },
      createdAt: now,
    });
    return id;
  },
});

/** A member can see only the request owned by their verified account. */
export const mine = query({
  args: {},
  returns: v.union(v.null(), vSelfView),
  handler: async (ctx) => {
    const profile = await requireMember(ctx);
    const account = await ctx.db
      .query("stakeholderAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerProfileId", profile._id))
      .unique();
    if (!account) return null;
    return {
      id: account._id,
      kind: account.kind,
      siteType: account.siteType,
      organizationName: account.organizationName,
      status: account.status,
      requestedAt: account.createdAt,
      reviewedAt: account.reviewedAt,
      reviewNote:
        account.status === "rejected" ? account.reviewNote : undefined,
    };
  },
});

/** The admin's bounded review queue. This does not grant data access. */
export const pending = query({
  args: {},
  returns: v.array(
    v.object({
      id: vAccountId,
      kind: vStakeholderKind,
      siteType: v.optional(vSiteType),
      organizationName: v.string(),
      requestedAt: v.number(),
      applicantPhone: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const accounts = await ctx.db
      .query("stakeholderAccounts")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending"))
      .take(100);
    const openAccounts = await openStakeholders(ctx, accounts);
    return Promise.all(
      openAccounts.map(async (account) => {
        const profile = await ctx.db.get("profiles", account.ownerProfileId);
        return {
          id: account._id,
          kind: account.kind,
          siteType: account.siteType,
          organizationName: account.organizationName,
          requestedAt: account.createdAt,
          applicantPhone: profile?.phone,
        };
      }),
    );
  },
});

/** Only the configured admin with TOTP can approve or reject a request. */
export const decide = mutation({
  args: {
    id: vAccountId,
    decision: v.union(v.literal("approve"), v.literal("reject")),
    reviewNote: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);
    const admin = await findProfile(ctx, user._id);
    if (admin?.kind !== "admin") throw new ConvexError("NO_ADMIN_PROFILE");
    const account = await ctx.db.get("stakeholderAccounts", args.id);
    if (account?.status !== "pending") {
      throw new ConvexError("NOT_PENDING");
    }
    if (!(await isProfileOpen(ctx, account.ownerProfileId)))
      throw new ConvexError("ACCOUNT_CLOSED");
    const note = args.reviewNote.trim();
    if (note.length < 10 || note.length > 1000) {
      throw new ConvexError("INVALID_REVIEW_NOTE");
    }
    const now = Date.now();
    const status = args.decision === "approve" ? "approved" : "rejected";
    await ctx.db.patch("stakeholderAccounts", args.id, {
      status,
      reviewedBy: admin._id,
      reviewedAt: now,
      reviewNote: note,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      action: `stakeholder.${status}`,
      entityTable: "stakeholderAccounts",
      entityId: args.id,
      actorProfileId: admin._id,
      metadata: { kind: account.kind, from: "pending", to: status },
      createdAt: now,
    });
    return null;
  },
});
