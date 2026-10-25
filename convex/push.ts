import { ConvexError, v } from "convex/values";

import { pushEnv } from "../src/lib/env";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx, query } from "./_generated/server";
import {
  checkedLocale,
  fingerprint,
  hasActivePushSession,
  isValidEndpoint,
  isValidExpoToken,
  isValidWebKeys,
  pushAudit,
  requireNotificationProfile,
  vSubscription,
} from "./lib/push";

export const settings = query({
  args: {},
  returns: v.object({
    webKey: v.union(v.string(), v.null()),
    expo: v.boolean(),
  }),
  handler: async (ctx) => {
    await requireNotificationProfile(ctx);
    const config = pushEnv();
    return { webKey: config.web?.publicKey ?? null, expo: config.expo };
  },
});

function checkInstallation(value: string) {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(value))
    throw new ConvexError("INVALID_INSTALLATION");
}

interface Registration {
  channel: "web" | "expo";
  endpoint: string;
  keys?: { p256dh: string; auth: string };
  locale: string;
  installationId: string;
}

async function checkRegistrationLimit(
  ctx: MutationCtx,
  profileId: Id<"profiles">,
  now: number,
) {
  const limit = await ctx.db
    .query("pushLimits")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .unique();
  const isSameWindow = limit !== null && now - limit.windowStart < 3_600_000;
  const registrations = isSameWindow ? limit.registrations + 1 : 1;
  if (registrations > 30) throw new ConvexError("RATE_LIMITED");
  const value = {
    profileId,
    windowStart: isSameWindow ? limit.windowStart : now,
    registrations,
  };
  if (limit) await ctx.db.patch(limit._id, value);
  else await ctx.db.insert("pushLimits", value);
}

async function removeOldDevices(
  ctx: MutationCtx,
  profile: Doc<"profiles">,
  installation: string,
  currentId: Id<"pushDevices"> | undefined,
  now: number,
) {
  const devices = await ctx.db
    .query("pushDevices")
    .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
    .take(10);
  let remaining = 0;
  for (const device of devices) {
    if (device._id === currentId) continue;
    const shouldRemove =
      device.expiresAt <= now ||
      device.installationId === installation ||
      !(await hasActivePushSession(ctx, device.sessionId, profile));
    if (shouldRemove) {
      await ctx.db.delete(device._id);
      await pushAudit(
        ctx,
        "push.replaced",
        "pushDevices",
        device._id,
        profile._id,
      );
    } else remaining++;
  }
  return remaining;
}

function canReuseDevice(
  current: Doc<"pushDevices"> | null,
  input: Registration,
  profileId: Id<"profiles">,
  sessionId: string,
  now: number,
): boolean {
  return (
    current?.profileId === profileId &&
    current.sessionId === sessionId &&
    current.installationId === input.installationId &&
    current.locale === input.locale &&
    current.keys?.auth === input.keys?.auth &&
    current.keys?.p256dh === input.keys?.p256dh &&
    current.expiresAt > now + 15 * 86_400_000
  );
}

async function register(
  ctx: MutationCtx,
  input: Registration,
): Promise<Id<"pushDevices">> {
  const profile = await requireNotificationProfile(ctx);
  const identity = await ctx.auth.getUserIdentity();
  const sessionId = identity?.sessionId;
  if (
    typeof sessionId !== "string" ||
    !(await hasActivePushSession(ctx, sessionId, profile))
  )
    throw new ConvexError("NOT_SIGNED_IN");
  checkInstallation(input.installationId);
  const locale = checkedLocale(input.locale);
  const now = Date.now();
  const hash = await fingerprint(input.endpoint);
  const current = await ctx.db
    .query("pushDevices")
    .withIndex("by_fingerprint", (q) => q.eq("fingerprint", hash))
    .unique();
  if (current && canReuseDevice(current, input, profile._id, sessionId, now))
    return current._id;
  const remaining = await removeOldDevices(
    ctx,
    profile,
    input.installationId,
    current?._id,
    now,
  );
  if (current?.profileId !== profile._id && remaining >= 10)
    throw new ConvexError("DEVICE_LIMIT");
  if (current?.profileId !== profile._id)
    await checkRegistrationLimit(ctx, profile._id, now);
  const value = {
    ...input,
    locale,
    fingerprint: hash,
    profileId: profile._id,
    sessionId,
    version: (current?.version ?? 0) + 1,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    updatedAt: now,
  };
  if (current) {
    // A token can belong to only one account. Old queued sends check ownership again.
    await ctx.db.patch(current._id, value);
    await pushAudit(
      ctx,
      current.profileId === profile._id ? "push.refreshed" : "push.reassigned",
      "pushDevices",
      current._id,
      profile._id,
    );
    return current._id;
  }
  const id = await ctx.db.insert("pushDevices", { ...value, createdAt: now });
  await pushAudit(ctx, "push.registered", "pushDevices", id, profile._id);
  return id;
}

export const registerWeb = mutation({
  args: {
    subscription: vSubscription,
    locale: v.string(),
    installationId: v.string(),
  },
  returns: v.id("pushDevices"),
  handler: async (ctx, args) => {
    if (!pushEnv().web) throw new ConvexError("PUSH_UNAVAILABLE");
    if (
      !isValidEndpoint(args.subscription.endpoint) ||
      !isValidWebKeys(args.subscription.keys)
    )
      throw new ConvexError("INVALID_SUBSCRIPTION");
    return register(ctx, {
      channel: "web",
      ...args.subscription,
      locale: args.locale,
      installationId: args.installationId,
    });
  },
});

export const registerExpo = mutation({
  args: { token: v.string(), locale: v.string(), installationId: v.string() },
  returns: v.id("pushDevices"),
  handler: async (ctx, args) => {
    if (!pushEnv().expo) throw new ConvexError("PUSH_UNAVAILABLE");
    if (!isValidExpoToken(args.token)) throw new ConvexError("INVALID_TOKEN");
    return register(ctx, {
      channel: "expo",
      endpoint: args.token,
      locale: args.locale,
      installationId: args.installationId,
    });
  },
});

export const unregisterInstallation = mutation({
  args: { installationId: v.string() },
  returns: v.null(),
  handler: async (ctx, { installationId }) => {
    const profile = await requireNotificationProfile(ctx);
    checkInstallation(installationId);
    const devices = await ctx.db
      .query("pushDevices")
      .withIndex("by_profile_installation", (q) =>
        q.eq("profileId", profile._id).eq("installationId", installationId),
      )
      .take(10);
    for (const device of devices) {
      await ctx.db.delete(device._id);
      await pushAudit(
        ctx,
        "push.revoked",
        "pushDevices",
        device._id,
        profile._id,
      );
    }
    return null;
  },
});

export const unregister = mutation({
  args: { id: v.id("pushDevices"), expectedSessionId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, expectedSessionId }) => {
    const profile = await requireNotificationProfile(ctx);
    const device = await ctx.db.get("pushDevices", id);
    if (!device) return null;
    if (device.profileId !== profile._id) throw new ConvexError("NOT_FOUND");
    // Late cleanup must not revoke a token rebound to another live session.
    if (
      expectedSessionId !== undefined &&
      device.sessionId !== expectedSessionId
    )
      return null;
    await ctx.db.delete(id);
    await pushAudit(ctx, "push.revoked", "pushDevices", id, profile._id);
    return null;
  },
});
