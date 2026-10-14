import { ConvexError, v } from "convex/values";

import { isLocale } from "../src/i18n/locales";
import { authEmailEnv } from "../src/lib/env";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { requireAdmin, requireUser } from "./lib/access";
import { isAdminEmail, validateAdminProfile } from "./lib/admin";
import { codeDelivery } from "./lib/sms";

/** What the sign-in screens can offer on this deployment. Public. */
export const signInOptions = query({
  args: {},
  returns: v.object({
    phone: v.boolean(),
    email: v.boolean(),
    adminSetup: v.boolean(),
  }),
  handler: async (ctx) => {
    const isPhone =
      codeDelivery({
        OSDIGITAL_API_KEY: process.env.OSDIGITAL_API_KEY,
        OSDIGITAL_SENDER_ID: process.env.OSDIGITAL_SENDER_ID,
        OSDIGITAL_ENTITY_ID: process.env.OSDIGITAL_ENTITY_ID,
        OSDIGITAL_TEMPLATE_ID: process.env.OSDIGITAL_TEMPLATE_ID,
        OSDIGITAL_OTP_MESSAGE: process.env.OSDIGITAL_OTP_MESSAGE,
        MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
        MSG91_OTP_TEMPLATE_ID: process.env.MSG91_OTP_TEMPLATE_ID,
        AUTH_DEV_MODE: process.env.AUTH_DEV_MODE,
      }).kind !== "off" || authEmailEnv()?.kind === "local";
    const isAdminExists =
      (await ctx.db.query("adminProfiles").first()) !== null;
    return {
      phone: isPhone,
      email: false,
      adminSetup: Boolean(process.env.ADMIN_EMAIL?.trim()) && !isAdminExists,
    };
  },
});

/** The signed-in person, or null. */
export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      kind: v.union(v.literal("member"), v.literal("admin")),
      phone: v.optional(v.string()),
      locale: v.optional(v.string()),
      twoFactorEnabled: v.boolean(),
      hasProfile: v.boolean(),
      hasPassword: v.boolean(),
      adminName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", user._id))
      .unique();
    const admin = profile
      ? await ctx.db
          .query("adminProfiles")
          .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
          .unique()
      : null;

    return {
      kind: isAdminEmail(user.email) ? ("admin" as const) : ("member" as const),
      phone: user.phoneNumber ?? undefined,
      locale: profile?.locale,
      twoFactorEnabled: user.twoFactorEnabled === true,
      hasProfile: profile !== null,
      hasPassword: Boolean(
        await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "account",
          where: [
            { field: "userId", value: user._id },
            { field: "providerId", value: "credential" },
          ],
        }),
      ),
      adminName: admin?.name,
    };
  },
});

/**
 * Creates the caller's profile on first sign-in, or updates their language.
 * Idempotent — safe to call after every sign-in.
 */
export const ensureProfile = mutation({
  args: { locale: v.string() },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const locale = isLocale(args.locale) ? args.locale : "en";
    const now = Date.now();

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", user._id))
      .unique();
    if (existing) {
      if (existing.locale !== locale) {
        await ctx.db.patch(existing._id, { locale, updatedAt: now });
      }
      return existing._id;
    }

    const profileId = await ctx.db.insert("profiles", {
      authUserId: user._id,
      phone: user.phoneNumber ?? undefined,
      kind: isAdminEmail(user.email) ? "admin" : "member",
      locale,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      action: "profile.created",
      entityTable: "profiles",
      entityId: profileId,
      actorProfileId: profileId,
      createdAt: now,
    });
    return profileId;
  },
});

/**
 * Saves the admin's identity record (name, phone, date of birth, last four
 * Aadhaar digits). Allowed before the authenticator is enrolled, because
 * setup collects it first.
 */
export const saveAdminProfile = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    dateOfBirth: v.string(),
    aadhaarLast4: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx, { allowWithoutTwoFactor: true });
    const checked = validateAdminProfile(args);
    if (!checked.ok) throw new ConvexError(`INVALID_${checked.error}`);

    const now = Date.now();
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", user._id))
      .unique();
    const profileId =
      existing?._id ??
      (await ctx.db.insert("profiles", {
        authUserId: user._id,
        phone: checked.value.phone,
        kind: "admin",
        locale: "en",
        createdAt: now,
        updatedAt: now,
      }));

    const record = {
      name: checked.value.name,
      email: user.email,
      phone: checked.value.phone,
      dateOfBirth: checked.value.dateOfBirth,
      aadhaarLast4: checked.value.aadhaarLast4,
      updatedAt: now,
    };
    const current = await ctx.db
      .query("adminProfiles")
      .withIndex("by_profileId", (q) => q.eq("profileId", profileId))
      .unique();
    await (current
      ? ctx.db.patch(current._id, record)
      : ctx.db.insert("adminProfiles", {
          profileId,
          createdAt: now,
          ...record,
        }));

    await ctx.db.insert("auditLog", {
      action: "admin.profile_saved",
      entityTable: "adminProfiles",
      entityId: profileId,
      actorProfileId: profileId,
      createdAt: now,
    });
    return null;
  },
});
