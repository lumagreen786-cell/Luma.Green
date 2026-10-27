import { ConvexError, v } from "convex/values";
import { z } from "zod";

import { isLocale } from "../../src/i18n/locales";
import { pushEnv } from "../../src/lib/env";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./access";
import { findProfile } from "./applicationAccess";
import { canAccessRecord } from "./collaboration";
import type { InboxEvent } from "./notificationConfig";
import { membershipFor } from "./workspace";

export const vSubscription = v.object({
  endpoint: v.string(),
  keys: v.object({ p256dh: v.string(), auth: v.string() }),
});

export function isValidEndpoint(value: string): boolean {
  if (value.length > 2048 || value.includes("\\")) return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    const isAllowed =
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
    return (
      isAllowed &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

export function isValidExpoToken(value: string): boolean {
  return (
    value.length <= 256 &&
    /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(value)
  );
}

export function isValidWebKeys(keys: {
  p256dh: string;
  auth: string;
}): boolean {
  return (
    /^B[A-Za-z0-9_-]{86}=?$/.test(keys.p256dh) &&
    /^[A-Za-z0-9_-]{22}={0,2}$/.test(keys.auth)
  );
}

export async function fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function requireNotificationProfile(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const profile = await findProfile(ctx, user._id);
  if (!profile) throw new ConvexError("NO_PROFILE");
  return profile;
}

/** A registration belongs to a live server session, not just an account. */
export async function hasActivePushSession(
  ctx: QueryCtx,
  sessionId: string | undefined,
  profile: Doc<"profiles">,
): Promise<boolean> {
  if (!sessionId || profile.closedAt !== undefined) return false;
  const stored: unknown = await ctx.runQuery(
    components.betterAuth.adapter.findOne,
    {
      model: "session",
      where: [{ field: "_id", value: sessionId }],
    },
  );
  const session = z
    .object({ userId: z.string(), expiresAt: z.number() })
    .safeParse(stored);
  return (
    session.success &&
    session.data.userId === profile.authUserId &&
    session.data.expiresAt > Date.now()
  );
}

export async function pushAudit(
  ctx: MutationCtx,
  action: string,
  table: string,
  id: string,
  profileId: Id<"profiles">,
) {
  await ctx.db.insert("auditLog", {
    action,
    entityTable: table,
    entityId: id,
    actorProfileId: profileId,
    createdAt: Date.now(),
  });
}

interface InboxInput {
  profileId: Id<"profiles">;
  event: InboxEvent;
  taskId?: Id<"recordTasks">;
  stockAlertId?: Id<"stockLowAlerts">;
  dedupKey: string;
}
async function isInboxInputValid(ctx: MutationCtx, input: InboxInput) {
  if (input.event === "stock_low") {
    if (
      input.taskId ||
      !(await canReadStockAlert(ctx, input.stockAlertId, input.profileId))
    )
      throw new ConvexError("INVALID_NOTIFICATION");
  } else if (input.stockAlertId) throw new ConvexError("INVALID_NOTIFICATION");
  if (input.event === "collaboration_updated") {
    const task = input.taskId
      ? await ctx.db.get("recordTasks", input.taskId)
      : null;
    return Boolean(
      task &&
      (await canAccessRecord(ctx, task.scope, task.record, input.profileId)),
    );
  }
  if (input.taskId) throw new ConvexError("INVALID_NOTIFICATION");
  return true;
}
export async function queueInbox(ctx: MutationCtx, input: InboxInput) {
  if (!(await isInboxInputValid(ctx, input))) return;
  const existing = await ctx.db
    .query("inbox")
    .withIndex("by_dedupKey", (q) => q.eq("dedupKey", input.dedupKey))
    .unique();
  if (existing) return;
  const now = Date.now();
  const inboxId = await ctx.db.insert("inbox", {
    ...input,
    read: false,
    createdAt: now,
  });
  await pushAudit(ctx, "inbox.created", "inbox", inboxId, input.profileId);
  // Stock settings opt in to the account inbox only, never device delivery.
  if (input.event === "stock_low") return;
  const config = pushEnv();
  if (!config.web && !config.expo) return;
  const devices = await ctx.db
    .query("pushDevices")
    .withIndex("by_profile", (q) => q.eq("profileId", input.profileId))
    .take(10);
  for (const device of devices) {
    if (
      (input.event === "collaboration_updated" && device.channel === "expo") ||
      device.expiresAt <= now ||
      !(device.channel === "web" ? config.web : config.expo)
    )
      continue;
    const id = await ctx.db.insert("pushDeliveries", {
      inboxId,
      deviceId: device._id,
      profileId: input.profileId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await pushAudit(ctx, "push.queued", "pushDeliveries", id, input.profileId);
    await ctx.scheduler.runAfter(0, internal.pushDelivery.send, { id });
  }
}

export function checkedLocale(locale: string): string {
  if (!isLocale(locale)) throw new ConvexError("INVALID_LOCALE");
  return locale;
}

/** Task notifications disappear when their recipient loses current record access. */
export async function canReadInboxItem(ctx: QueryCtx, row: Doc<"inbox">) {
  if (row.event === "stock_low")
    return canReadStockAlert(ctx, row.stockAlertId, row.profileId);
  if (row.event !== "collaboration_updated") return true;
  const task = row.taskId ? await ctx.db.get("recordTasks", row.taskId) : null;
  return task
    ? canAccessRecord(ctx, task.scope, task.record, row.profileId)
    : false;
}

async function canReadStockAlert(
  ctx: QueryCtx,
  id: Id<"stockLowAlerts"> | undefined,
  profileId: Id<"profiles">,
) {
  if (!id) return false;
  const alert = await ctx.db.get("stockLowAlerts", id);
  if (alert?.recipientProfileId !== profileId) return false;
  const org = await ctx.db.get("orgs", alert.orgId);
  return (
    (org?.status === "active" || org?.status === "suspended") &&
    Boolean(await membershipFor(ctx, profileId, alert.orgId))
  );
}
