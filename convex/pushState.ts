import { v } from "convex/values";

import { pushEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { canReadInboxItem, hasActivePushSession, pushAudit } from "./lib/push";

const sendTarget = v.object({
  deviceId: v.id("pushDevices"),
  channel: v.union(v.literal("web"), v.literal("expo")),
  endpoint: v.string(),
  keys: v.optional(v.object({ p256dh: v.string(), auth: v.string() })),
  locale: v.string(),
});

export const claim = internalMutation({
  args: { id: v.id("pushDeliveries") },
  returns: v.union(v.null(), sendTarget),
  handler: async (ctx, { id }) => {
    const delivery = await ctx.db.get("pushDeliveries", id);
    if (delivery?.status !== "pending") return null;
    const inbox = await ctx.db.get("inbox", delivery.inboxId);
    const canRead = inbox && (await canReadInboxItem(ctx, inbox));
    const device = await ctx.db.get("pushDevices", delivery.deviceId);
    const profile = device
      ? await ctx.db.get("profiles", device.profileId)
      : null;
    const hasSession =
      device &&
      profile &&
      (await hasActivePushSession(ctx, device.sessionId, profile));
    // Retire only this delivery's device owner. A token reassigned to another
    // account must survive cancellation of the previous account's queued work.
    if (!hasSession && device?.profileId === delivery.profileId) {
      await ctx.db.delete(device._id);
      await pushAudit(
        ctx,
        "push.revoked",
        "pushDevices",
        device._id,
        device.profileId,
      );
    }
    const now = Date.now();
    const attempts = await ctx.db
      .query("pushDeliveries")
      .withIndex("by_profile_attemptedAt", (q) =>
        q
          .eq("profileId", delivery.profileId)
          .gte("attemptedAt", now - 86_400_000),
      )
      .take(30);
    if (
      !canRead ||
      !hasSession ||
      device.profileId !== delivery.profileId ||
      device.expiresAt <= now ||
      !(device.channel === "web" ? pushEnv().web : pushEnv().expo) ||
      attempts.length >= 30
    ) {
      await ctx.db.patch(id, { status: "cancelled", updatedAt: now });
      await pushAudit(
        ctx,
        "push.cancelled",
        "pushDeliveries",
        id,
        delivery.profileId,
      );
      return null;
    }
    await ctx.db.patch(id, {
      status: "sending",
      attemptedAt: now,
      updatedAt: now,
    });
    await pushAudit(
      ctx,
      "push.sending",
      "pushDeliveries",
      id,
      delivery.profileId,
    );
    await ctx.scheduler.runAfter(60_000, internal.pushState.expire, { id });
    return {
      deviceId: device._id,
      channel: device.channel,
      endpoint: device.endpoint,
      keys: device.keys,
      locale: device.locale,
    };
  },
});

export const finish = internalMutation({
  args: {
    id: v.id("pushDeliveries"),
    status: v.union(
      v.literal("accepted"),
      v.literal("failed"),
      v.literal("unknown"),
    ),
    removeDevice: v.boolean(),
    receiptId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("pushDeliveries", args.id);
    if (delivery?.status === "sending") {
      await ctx.db.patch(args.id, {
        status: args.status,
        updatedAt: Date.now(),
        receiptId: args.receiptId,
      });
      await pushAudit(
        ctx,
        `push.${args.status}`,
        "pushDeliveries",
        args.id,
        delivery.profileId,
      );
      const device = await ctx.db.get("pushDevices", delivery.deviceId);
      if (args.removeDevice && device?.profileId === delivery.profileId) {
        await ctx.db.delete(device._id);
        await pushAudit(
          ctx,
          "push.expired",
          "pushDevices",
          device._id,
          device.profileId,
        );
      }
      if (args.receiptId)
        await ctx.scheduler.runAfter(
          15 * 60_000,
          internal.pushDelivery.receipt,
          {
            id: args.id,
            receiptId: args.receiptId,
          },
        );
    }
    return null;
  },
});

export const expire = internalMutation({
  args: { id: v.id("pushDeliveries") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const delivery = await ctx.db.get("pushDeliveries", id);
    if (delivery?.status === "sending") {
      await ctx.db.patch(id, { status: "unknown", updatedAt: Date.now() });
      await pushAudit(
        ctx,
        "push.unknown",
        "pushDeliveries",
        id,
        delivery.profileId,
      );
    }
    return null;
  },
});

export const receipt = internalMutation({
  args: {
    id: v.id("pushDeliveries"),
    receiptId: v.string(),
    rejected: v.boolean(),
    removeDevice: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("pushDeliveries", args.id);
    if (
      delivery?.receiptId === args.receiptId &&
      delivery.status === "accepted"
    ) {
      if (args.rejected) {
        await ctx.db.patch(args.id, {
          status: "failed",
          updatedAt: Date.now(),
        });
        await pushAudit(
          ctx,
          "push.receipt_failed",
          "pushDeliveries",
          args.id,
          delivery.profileId,
        );
      }
      const device = await ctx.db.get("pushDevices", delivery.deviceId);
      if (args.removeDevice && device?.profileId === delivery.profileId) {
        await ctx.db.delete(device._id);
        await pushAudit(
          ctx,
          "push.expired",
          "pushDevices",
          device._id,
          device.profileId,
        );
      }
    }
    return null;
  },
});
