import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireAdmin, requireUser } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { verifiedIndianMobile } from "./lib/phone";
import {
  privacyRequestKinds,
  vPrivacyRequestKind,
  vPrivacyRequestStatus,
} from "./lib/privacyRequestSchema";

const publicFields = {
  id: v.id("privacyRequests"),
  kind: vPrivacyRequestKind,
  status: vPrivacyRequestStatus,
  createdAt: v.number(),
  respondedAt: v.optional(v.number()),
};

export const mine = query({
  args: {},
  returns: v.union(v.null(), v.array(v.object(publicFields))),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) return null;

    const [received, responded] = await Promise.all([
      ctx.db
        .query("privacyRequests")
        .withIndex("by_profileId_status", (q) =>
          q.eq("profileId", profile._id).eq("status", "received"),
        )
        .order("desc")
        .take(privacyRequestKinds.length),
      ctx.db
        .query("privacyRequests")
        .withIndex("by_profileId_status", (q) =>
          q.eq("profileId", profile._id).eq("status", "responded"),
        )
        .order("desc")
        .take(20),
    ]);

    return [...received, ...responded].map((row) => ({
      id: row._id,
      kind: row.kind,
      status: row.status,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
    }));
  },
});

/** One open request per account and category. Do not collect identity documents here. */
export const submit = mutation({
  args: { kind: vPrivacyRequestKind },
  returns: v.id("privacyRequests"),
  handler: async (ctx, { kind }) => {
    const user = await requireUser(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");

    const existing = await ctx.db
      .query("privacyRequests")
      .withIndex("by_profileId_status_kind", (q) =>
        q
          .eq("profileId", profile._id)
          .eq("status", "received")
          .eq("kind", kind),
      )
      .unique();
    if (existing) return existing._id;

    const createdAt = Date.now();
    const id = await ctx.db.insert("privacyRequests", {
      profileId: profile._id,
      kind,
      status: "received",
      createdAt,
    });
    await ctx.db.insert("auditLog", {
      action: "privacy_request.received",
      entityTable: "privacyRequests",
      entityId: id,
      actorProfileId: profile._id,
      createdAt,
    });
    return id;
  },
});

export const queue = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("privacyRequests"),
      profileId: v.id("profiles"),
      kind: vPrivacyRequestKind,
      createdAt: v.number(),
      phone: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("privacyRequests")
      .withIndex("by_status", (q) => q.eq("status", "received"))
      .take(50);
    return Promise.all(
      rows.map(async (row) => {
        const profile = await ctx.db.get("profiles", row.profileId);
        const user =
          profile && profile.closedAt === undefined
            ? await authComponent.getAnyUserById(ctx, profile.authUserId)
            : null;
        return {
          id: row._id,
          profileId: row.profileId,
          kind: row.kind,
          createdAt: row.createdAt,
          phone:
            verifiedIndianMobile(
              user?.phoneNumber,
              user?.phoneNumberVerified,
            ) ?? undefined,
        };
      }),
    );
  },
});

/** Record that staff replied. This does not execute the request. */
export const recordResponse = mutation({
  args: { id: v.id("privacyRequests") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const user = await requireAdmin(ctx);
    const profile = await findProfile(ctx, user._id);
    if (!profile) throw new ConvexError("NO_PROFILE");
    const row = await ctx.db.get("privacyRequests", id);
    if (!row) throw new ConvexError("NOT_FOUND");
    if (row.status === "responded") return null;

    const respondedAt = Date.now();
    await ctx.db.patch("privacyRequests", id, {
      status: "responded",
      respondedAt,
    });
    await ctx.db.insert("auditLog", {
      action: "privacy_request.responded",
      entityTable: "privacyRequests",
      entityId: id,
      actorProfileId: profile._id,
      createdAt: respondedAt,
    });
    return null;
  },
});
