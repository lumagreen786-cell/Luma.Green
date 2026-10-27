import { v } from "convex/values";

import { photoEstimateEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { openAuthUser } from "./lib/access";
import {
  isPhotoDataUrl,
  PHOTO_DAY_MS,
  photoAllowance,
  type PhotoEstimateReply,
} from "./lib/photoEstimates";
import { requestPhotoEstimate } from "./lib/photoProvider";

const CLEANUP_BUCKET_MS = 60 * 60 * 1000;
function cleanupTime(at: number) {
  return Math.ceil((at + PHOTO_DAY_MS) / CLEANUP_BUCKET_MS) * CLEANUP_BUCKET_MS;
}

const itemValidator = v.object({
  materialCode: v.string(),
  gramsLow: v.number(),
  gramsHigh: v.number(),
  confidence: v.number(),
});
const replyValidator = v.union(
  v.object({
    status: v.literal("ok"),
    result: v.object({
      items: v.array(itemValidator),
      retake: v.union(
        v.literal("none"),
        v.literal("too_dark"),
        v.literal("too_far"),
        v.literal("not_scrap"),
      ),
    }),
  }),
  v.object({
    status: v.union(
      v.literal("unavailable"),
      v.literal("failed"),
      v.literal("invalid"),
      v.literal("limited"),
    ),
  }),
);

/** Public before phone verification, like the manual catalogue. Never stores the image or output. */
export const estimate = action({
  args: { image: v.string(), deviceId: v.string() },
  returns: replyValidator,
  handler: async (ctx, { image, deviceId }): Promise<PhotoEstimateReply> => {
    const config = photoEstimateEnv();
    if (!config) return { status: "unavailable" };
    if (
      !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
        deviceId,
      ) ||
      !isPhotoDataUrl(image)
    )
      return { status: "invalid" };
    try {
      const catalogue = await ctx.runQuery(
        internal.photoEstimates.catalogue,
        {},
      );
      if (catalogue.length === 0) return { status: "unavailable" };
      const user = await openAuthUser(ctx);
      const hash = async (text: string) => {
        const bytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`${config.apiKey}:${text}`),
        );
        return Array.from(new Uint8Array(bytes), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
      };
      const deviceHash = await hash(`device:${deviceId}`);
      const phoneHash =
        user?.phoneNumberVerified && user.phoneNumber
          ? await hash(`phone:${user.phoneNumber}`)
          : undefined;
      const isAllowed = await ctx.runMutation(internal.photoEstimates.reserve, {
        deviceHash,
        phoneHash,
        dailyLimit: config.dailyLimit,
      });
      if (!isAllowed) return { status: "limited" };
      return {
        status: "ok",
        result: await requestPhotoEstimate(config, image, catalogue),
      };
    } catch {
      // Expected provider/config/auth transport failures never expose bodies, images or keys.
      return { status: "failed" };
    }
  },
});

export const catalogue = internalQuery({
  args: {},
  returns: v.array(v.object({ code: v.string(), name: v.string() })),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("materials")
      .withIndex("by_sortOrder")
      .take(500);
    return rows
      .filter((row) => row.active && row.stage === "scrap")
      .map((row) => ({
        code: row.code,
        name: (Object.hasOwn(row.names, "en") ? row.names.en : row.code).slice(
          0,
          160,
        ),
      }));
  },
});

/** One indexed, bounded row makes global/device/verified-phone checks atomic. */
export const reserve = internalMutation({
  args: {
    deviceHash: v.string(),
    phoneHash: v.optional(v.string()),
    dailyLimit: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, { deviceHash, phoneHash, dailyLimit }) => {
    if (
      !/^[a-f\d]{64}$/.test(deviceHash) ||
      (phoneHash !== undefined && !/^[a-f\d]{64}$/.test(phoneHash))
    )
      return false;
    const row = await ctx.db
      .query("photoEstimateQuota")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const now = Date.now();
    const allowance = photoAllowance(
      row?.reservations ?? [],
      now,
      deviceHash,
      phoneHash,
      dailyLimit,
    );
    if (!allowance.allowed) return false;
    const reservations = [
      ...allowance.recent,
      { at: now, deviceHash, ...(phoneHash && { phoneHash }) },
    ];
    const cleanupScheduledAt =
      row?.cleanupScheduledAt && row.cleanupScheduledAt > now
        ? row.cleanupScheduledAt
        : cleanupTime(reservations[0].at);
    if (row) await ctx.db.patch(row._id, { reservations, cleanupScheduledAt });
    else
      await ctx.db.insert("photoEstimateQuota", {
        key: "global",
        reservations,
        cleanupScheduledAt,
      });
    if (cleanupScheduledAt !== row?.cleanupScheduledAt) {
      await ctx.scheduler.runAt(
        cleanupScheduledAt,
        internal.photoEstimates.expire,
        {},
      );
    }
    return true;
  },
});

export const expire = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("photoEstimateQuota")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const now = Date.now();
    // An old queued job must not create another cleanup chain.
    if (row && (!row.cleanupScheduledAt || row.cleanupScheduledAt <= now)) {
      const reservations = row.reservations.filter(
        (entry) => entry.at > now - PHOTO_DAY_MS,
      );
      if (reservations.length === 0) await ctx.db.delete(row._id);
      else {
        const cleanupScheduledAt = cleanupTime(reservations[0].at);
        await ctx.db.patch(row._id, { reservations, cleanupScheduledAt });
        await ctx.scheduler.runAt(
          cleanupScheduledAt,
          internal.photoEstimates.expire,
          {},
        );
      }
    }
    return null;
  },
});

/** Public boolean only; a disabled integration never asks for an image. */
export const available = query({
  args: {},
  returns: v.boolean(),
  handler: () => photoEstimateEnv() !== undefined,
});
