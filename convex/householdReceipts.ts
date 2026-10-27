import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx, query } from "./_generated/server";
import {
  collectionActor,
  collectionByToken,
  collectionGrants,
  isCollectionOpen,
  isGrantActive,
} from "./lib/collectionAccess";
import { normalizeIndianMobile } from "./lib/phone";
import { collectionPaymentIssue } from "./support";

async function audit(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  actorProfileId: Id<"profiles">,
  action: string,
) {
  await ctx.db.insert("auditLog", {
    orgId: booking.orgId,
    actorProfileId,
    action,
    entityTable: "bookings",
    entityId: booking._id,
    createdAt: Date.now(),
  });
}

export const invite = mutation({
  args: { token: v.string(), phone: v.string(), adultConfirmed: v.boolean() },
  returns: v.id("collectionInvitations"),
  handler: async (ctx, args) => {
    const { profile } = await collectionActor(ctx);
    const booking = await collectionByToken(ctx, args.token);
    if (booking.householdProfileId !== profile._id)
      throw new ConvexError("NOT_YOURS");
    const phone = normalizeIndianMobile(args.phone);
    if (!phone || !args.adultConfirmed || !isCollectionOpen(booking))
      throw new ConvexError("INVALID_INVITATION");
    const grants = await collectionGrants(ctx, booking);
    const existing = grants.find(
      (g) => g.phone === phone && isGrantActive(g, booking),
    );
    if (existing) return existing._id;
    if (grants.length >= 20) throw new ConvexError("INVITATION_LIMIT");
    const id = await ctx.db.insert("collectionInvitations", {
      bookingId: booking._id,
      ownerProfileId: profile._id,
      phone,
      expiresAt: Date.now() + 48 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });
    await audit(ctx, booking, profile._id, "collection.invited");
    return id;
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string(), adultConfirmed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, phone } = await collectionActor(ctx);
    const booking = await collectionByToken(ctx, args.token);
    const grants = await collectionGrants(ctx, booking);
    const grant = grants.find(
      (g) =>
        g.phone === phone &&
        isGrantActive(g, booking) &&
        (!g.helperProfileId || g.helperProfileId === profile._id),
    );
    if (
      !grant ||
      !args.adultConfirmed ||
      booking.householdProfileId === profile._id
    )
      throw new ConvexError("INVITATION_UNAVAILABLE");
    if (grant.helperProfileId) return null;
    await ctx.db.patch("collectionInvitations", grant._id, {
      helperProfileId: profile._id,
    });
    await audit(ctx, booking, profile._id, "collection.invitation_accepted");
    return null;
  },
});

const vSharing = v.object({
  id: v.id("collectionInvitations"),
  phone: v.optional(v.string()),
  accepted: v.boolean(),
  expiresAt: v.number(),
  active: v.boolean(),
  handoverNote: v.optional(v.string()),
});
export const sharing = query({
  args: { token: v.string() },
  returns: v.array(vSharing),
  handler: async (ctx, args) => {
    const { profile, phone } = await collectionActor(ctx);
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .unique();
    if (!booking) return [];
    const isOwner = booking.householdProfileId === profile._id;
    const grants = await collectionGrants(ctx, booking);
    return grants
      .filter(
        (g) =>
          isOwner ||
          (g.phone === phone &&
            (!g.helperProfileId || g.helperProfileId === profile._id) &&
            isGrantActive(g, booking)),
      )
      .map((g) => ({
        id: g._id,
        phone: isOwner ? g.phone : undefined,
        accepted: g.helperProfileId !== undefined,
        expiresAt: g.expiresAt,
        active: isGrantActive(g, booking),
        handoverNote: g.handoverNote,
      }));
  },
});

export const endInvitation = mutation({
  args: { invitationId: v.id("collectionInvitations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await collectionActor(ctx);
    const grant = await ctx.db.get("collectionInvitations", args.invitationId);
    if (
      !grant ||
      (grant.ownerProfileId !== profile._id &&
        grant.helperProfileId !== profile._id)
    )
      throw new ConvexError("NOT_YOURS");
    if (grant.endedAt) return null;
    const booking = await ctx.db.get("bookings", grant.bookingId);
    if (!booking) throw new ConvexError("NOT_FOUND");
    await ctx.db.patch("collectionInvitations", grant._id, {
      endedAt: Date.now(),
    });
    await audit(ctx, booking, profile._id, "collection.invitation_ended");
    return null;
  },
});

export const handover = mutation({
  args: { token: v.string(), note: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, phone } = await collectionActor(ctx);
    const booking = await collectionByToken(ctx, args.token);
    const grants = await collectionGrants(ctx, booking);
    const grant = grants.find(
      (g) =>
        g.helperProfileId === profile._id &&
        g.phone === phone &&
        isGrantActive(g, booking),
    );
    const note = args.note.trim();
    if (!grant || !note || note.length > 500)
      throw new ConvexError("INVALID_HANDOVER");
    if (grant.handoverNote === note) return null;
    if (grant.handoverAt) throw new ConvexError("HANDOVER_ALREADY_RECORDED");
    await ctx.db.patch("collectionInvitations", grant._id, {
      handoverNote: note,
      handoverAt: Date.now(),
    });
    await audit(ctx, booking, profile._id, "collection.handover_recorded");
    return null;
  },
});

export const review = mutation({
  args: {
    token: v.string(),
    receiptVersion: v.number(),
    decision: v.union(v.literal("accepted"), v.literal("disputed")),
    rejectedLineIndexes: v.array(v.number()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, phone } = await collectionActor(ctx);
    const booking = await collectionByToken(ctx, args.token);
    if (booking.householdProfileId !== profile._id)
      throw new ConvexError("NOT_YOURS");
    const receipt = booking.receipt;
    if (receipt?.paidAt !== args.receiptVersion)
      throw new ConvexError("RECEIPT_CHANGED");
    const indexes = [...new Set(args.rejectedLineIndexes)].toSorted(
      (a, b) => a - b,
    );
    const note = args.note?.trim();
    if (
      (note?.length ?? 0) > 500 ||
      (args.decision === "accepted" && indexes.length > 0) ||
      (!note && args.decision === "disputed") ||
      indexes.some(
        (i) => !Number.isSafeInteger(i) || i < 0 || i >= receipt.lines.length,
      )
    )
      throw new ConvexError("INVALID_REVIEW");
    const prior = booking.receiptReview;
    if (prior) {
      const firstDecision = await ctx.db
        .query("householdReceiptEvents")
        .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
        .first();
      if (
        prior.receiptVersion === args.receiptVersion &&
        prior.decision === args.decision &&
        firstDecision?.note === note &&
        JSON.stringify(prior.rejectedLineIndexes) === JSON.stringify(indexes)
      )
        return null;
      throw new ConvexError("RECEIPT_REVIEW_HELD");
    }
    const accepted = receipt.lines.filter((_, i) => !indexes.includes(i));
    await ctx.db.patch("bookings", booking._id, {
      receiptReview: {
        receiptVersion: args.receiptVersion,
        decision: args.decision,
        rejectedLineIndexes: indexes,
        acceptedGrams: accepted.reduce((sum, l) => sum + l.grams, 0),
        acceptedPaise: accepted.reduce((sum, l) => sum + l.paise, 0),
        reviewedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
    await ctx.db.insert("householdReceiptEvents", {
      bookingId: booking._id,
      actorProfileId: profile._id,
      receiptVersion: args.receiptVersion,
      decision: args.decision,
      rejectedLineIndexes: indexes,
      note,
      createdAt: Date.now(),
    });
    if (args.decision === "disputed") {
      await collectionPaymentIssue(
        ctx,
        booking,
        profile._id,
        phone,
        note ?? "",
      );
    }
    await audit(ctx, booking, profile._id, `receipt.${args.decision}`);
    return null;
  },
});

export const acknowledgePayment = mutation({
  args: { token: v.string(), receiptVersion: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await collectionActor(ctx);
    const booking = await collectionByToken(ctx, args.token);
    if (booking.householdProfileId !== profile._id)
      throw new ConvexError("NOT_YOURS");
    const review = booking.receiptReview;
    if (
      booking.receipt?.paidAt !== args.receiptVersion ||
      review?.receiptVersion !== args.receiptVersion ||
      review.decision !== "accepted"
    )
      throw new ConvexError("ACCEPT_RECEIPT_FIRST");
    if (review.paymentAcknowledgedAt) return null;
    await ctx.db.patch("bookings", booking._id, {
      receiptReview: { ...review, paymentAcknowledgedAt: Date.now() },
      updatedAt: Date.now(),
    });
    await ctx.db.insert("householdReceiptEvents", {
      bookingId: booking._id,
      actorProfileId: profile._id,
      receiptVersion: args.receiptVersion,
      decision: "payment_acknowledged",
      rejectedLineIndexes: [],
      createdAt: Date.now(),
    });
    await audit(ctx, booking, profile._id, "receipt.payment_acknowledged");
    return null;
  },
});

export const history = query({
  args: { token: v.string() },
  returns: v.array(
    v.object({
      id: v.id("householdReceiptEvents"),
      receiptVersion: v.number(),
      decision: v.union(
        v.literal("accepted"),
        v.literal("disputed"),
        v.literal("payment_acknowledged"),
      ),
      rejectedLineIndexes: v.array(v.number()),
      note: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const { profile } = await collectionActor(ctx);
    const booking = await collectionByToken(ctx, args.token);
    if (booking.householdProfileId !== profile._id)
      throw new ConvexError("NOT_YOURS");
    const events = await ctx.db
      .query("householdReceiptEvents")
      .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
      .order("desc")
      .take(50);
    return events.map((event) => ({
      id: event._id,
      receiptVersion: event.receiptVersion,
      decision: event.decision,
      rejectedLineIndexes: event.rejectedLineIndexes,
      note: event.note,
      createdAt: event.createdAt,
    }));
  },
});
