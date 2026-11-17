import { v } from "convex/values";

import { internal } from "./_generated/api";
import {
  httpAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { codeDelivery } from "./lib/sms";

export const recordSms = internalMutation({
  args: { accepted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { accepted }) => {
    const row = await ctx.db
      .query("serviceHealth")
      .withIndex("by_service", (q) => q.eq("service", "sms"))
      .unique();
    const value = { service: "sms" as const, accepted, observedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, value);
    else await ctx.db.insert("serviceHealth", value);
    return null;
  },
});

export const snapshot = internalQuery({
  // The HTTP action supplies time so query caching cannot freeze freshness.
  args: { checkedAt: v.number() },
  returns: v.object({
    api: v.literal("up"),
    sms: v.union(
      v.literal("unavailable"),
      v.literal("accepted"),
      v.literal("failed"),
      v.literal("unknown"),
    ),
    observedAt: v.union(v.number(), v.null()),
    checkedAt: v.number(),
  }),
  handler: async (ctx, { checkedAt }) => {
    const row = await ctx.db
      .query("serviceHealth")
      .withIndex("by_service", (q) => q.eq("service", "sms"))
      .unique();
    const isConfigured =
      codeDelivery({
        OSDIGITAL_API_KEY: process.env.OSDIGITAL_API_KEY,
        OSDIGITAL_SENDER_ID: process.env.OSDIGITAL_SENDER_ID,
        OSDIGITAL_ENTITY_ID: process.env.OSDIGITAL_ENTITY_ID,
        OSDIGITAL_TEMPLATE_ID: process.env.OSDIGITAL_TEMPLATE_ID,
        OSDIGITAL_OTP_MESSAGE: process.env.OSDIGITAL_OTP_MESSAGE,
        MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
        MSG91_OTP_TEMPLATE_ID: process.env.MSG91_OTP_TEMPLATE_ID,
      }).kind !== "off";
    let sms: "unavailable" | "unknown" | "accepted" | "failed" = "unknown";
    if (!isConfigured) sms = "unavailable";
    else if (row && checkedAt - row.observedAt <= 15 * 60_000) {
      sms = row.accepted ? "accepted" : "failed";
    }
    return {
      api: "up" as const,
      sms,
      observedAt: row?.observedAt ?? null,
      checkedAt,
    };
  },
});

/** A read-only probe. Never sends SMS or calls a paid provider. */
export const health = httpAction(async (ctx) => {
  const snapshot = await ctx.runQuery(internal.serviceStatus.snapshot, {
    checkedAt: Date.now(),
  });
  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
