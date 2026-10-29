import type { FunctionHandle } from "convex/server";
import { v } from "convex/values";

import { mutation } from "./_generated/server";

function counter(value: number | null = 0): number {
  if (value === null) return 0;
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid stored auth count.");
  return value;
}
function timestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid auth timestamp.");
}

// These are public only inside the component, as with adapter.ts. The parent
// owns the references; there is no root public mutation or HTTP endpoint.
export const incrementOne = mutation({
  args: {
    factorId: v.id("twoFactor"),
    operation: v.union(
      v.object({ kind: v.literal("increment") }),
      v.object({ kind: v.literal("resetExpired"), expiredAtMs: v.number() }),
      v.object({
        kind: v.literal("replaceBackupCodes"),
        expectedBackupCodes: v.string(),
        backupCodes: v.string(),
        onUpdateHandle: v.string(),
      }),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({ failedVerificationCount: v.number() }),
    v.object({ failedVerificationCount: v.number(), lockedUntil: v.null() }),
    v.object({ backupCodes: v.string() }),
  ),
  handler: async (ctx, { factorId, operation }) => {
    if (operation.kind === "resetExpired") {
      timestamp(operation.expiredAtMs);
      if (operation.expiredAtMs > Date.now())
        throw new Error("Invalid atomic factor reset guard.");
    }
    const row = await ctx.db.get("twoFactor", factorId);
    if (!row) return null;
    if (operation.kind === "replaceBackupCodes") {
      if (row.backupCodes !== operation.expectedBackupCodes) return null;
      const update = { backupCodes: operation.backupCodes };
      await ctx.db.patch("twoFactor", factorId, update);
      await ctx.runMutation(
        operation.onUpdateHandle as FunctionHandle<"mutation">,
        {
          model: "twoFactor",
          oldDoc: row,
          newDoc: { ...row, ...update },
        },
      );
      return update;
    }
    const count = counter(row.failedVerificationCount);
    if (operation.kind === "resetExpired") {
      if (row.lockedUntil === undefined || row.lockedUntil === null)
        return null;
      timestamp(row.lockedUntil);
      if (row.lockedUntil > operation.expiredAtMs) return null;
      await ctx.db.patch("twoFactor", factorId, {
        failedVerificationCount: 0,
        lockedUntil: null,
      });
      return { failedVerificationCount: 0, lockedUntil: null };
    }
    if (count === Number.MAX_SAFE_INTEGER)
      throw new Error("Auth count overflow.");
    const failedVerificationCount = count + 1;
    await ctx.db.patch("twoFactor", factorId, { failedVerificationCount });
    return { failedVerificationCount };
  },
});

export const consumeRateLimit = mutation({
  args: {
    key: v.string(),
    operation: v.union(
      v.object({
        kind: v.literal("reset"),
        observedAtMs: v.number(),
        now: v.number(),
      }),
      v.object({
        kind: v.literal("consume"),
        windowStart: v.number(),
        maximum: v.number(),
        now: v.number(),
      }),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      rowId: v.id("rateLimit"),
      count: v.number(),
      lastRequest: v.number(),
    }),
  ),
  handler: async (ctx, { key, operation }) => {
    timestamp(operation.now);
    const row = await ctx.db
      .query("rateLimit")
      .withIndex("key", (query) => query.eq("key", key))
      .unique();
    if (!row) return null;
    const previous = counter(row.count);
    timestamp(row.lastRequest);
    let count: number;
    if (operation.kind === "reset") {
      timestamp(operation.observedAtMs);
      if (operation.observedAtMs >= operation.now)
        throw new Error("Invalid rate reset guard.");
      if (row.lastRequest > operation.observedAtMs) return null;
      count = 1;
    } else {
      timestamp(operation.windowStart);
      const maximum = counter(operation.maximum);
      if (operation.windowStart > operation.now)
        throw new Error("Invalid rate consumption guard.");
      if (row.lastRequest <= operation.windowStart || previous >= maximum)
        return null;
      if (previous === Number.MAX_SAFE_INTEGER)
        throw new Error("Auth count overflow.");
      count = previous + 1;
    }
    const lastRequest = operation.now;
    await ctx.db.patch("rateLimit", row._id, { count, lastRequest });
    return { rowId: row._id, count, lastRequest };
  },
});
