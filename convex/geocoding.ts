import { ConvexError, v } from "convex/values";

import { geocodingEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { requireUser } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { indiaToday } from "./lib/onboarding";

export const GEOCODING_DAILY_LIMIT = 10;
type Result =
  | { status: "found"; address: string; allowAddressSave: boolean }
  | { status: "unavailable" | "no_match" | "duplicate" | "limit" };
const point = { lat: v.number(), lng: v.number() };
export const geocodingResult = v.union(
  v.object({
    status: v.literal("found"),
    address: v.string(),
    allowAddressSave: v.boolean(),
  }),
  v.object({
    status: v.union(
      v.literal("unavailable"),
      v.literal("no_match"),
      v.literal("duplicate"),
      v.literal("limit"),
    ),
  }),
);

async function verifiedProfile(ctx: MutationCtx) {
  const user = await requireUser(ctx);
  if (!user.phoneNumber || !user.phoneNumberVerified)
    throw new ConvexError("PHONE_REQUIRED");
  const profile = await findProfile(ctx, user._id);
  if (profile?.kind !== "member") throw new ConvexError("NO_PROFILE");
  return profile;
}

/** This transaction runs before transport; failures and timeouts still use allowance. */
export const reserve = internalMutation({
  args: { fingerprint: v.string() },
  returns: v.union(
    v.literal("reserved"),
    v.literal("duplicate"),
    v.literal("limit"),
  ),
  handler: async (ctx, { fingerprint }) => {
    const profile = await verifiedProfile(ctx);
    if (!/^[a-f0-9]{64}$/.test(fingerprint))
      throw new ConvexError("VALIDATION_REQUIRED");
    const day = indiaToday();
    const row = await ctx.db
      .query("geocodingAccountDays")
      .withIndex("by_profile_day", (q) =>
        q.eq("profileId", profile._id).eq("day", day),
      )
      .unique();
    if (row?.fingerprints.includes(fingerprint)) return "duplicate";
    if (
      row &&
      (row.used >= GEOCODING_DAILY_LIMIT || Date.now() - row.lastAt < 5000)
    )
      return "limit";
    const values = {
      profileId: profile._id,
      day,
      used: (row?.used ?? 0) + 1,
      fingerprints: [...(row?.fingerprints ?? []), fingerprint],
      lastAt: Date.now(),
    };
    if (row) await ctx.db.replace("geocodingAccountDays", row._id, values);
    else await ctx.db.insert("geocodingAccountDays", values);
    await ctx.db.insert("auditLog", {
      action: "geocoding.reserved",
      entityTable: "profiles",
      entityId: profile._id,
      actorProfileId: profile._id,
      metadata: {
        provider: "google_maps",
        consent: true,
        consentVersion: "2026-10-27",
      },
      createdAt: Date.now(),
    });
    return "reserved";
  },
});

async function readPayload(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  let chunk = await reader.read();
  while (!chunk.done) {
    bytes += chunk.value.byteLength;
    if (bytes > 200_000) {
      await reader.cancel();
      throw new Error("INVALID_RESPONSE");
    }
    text += decoder.decode(chunk.value, { stream: true });
    chunk = await reader.read();
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}
function addressFrom(payload: unknown): string | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("status" in payload) ||
    payload.status !== "OK" ||
    !("results" in payload) ||
    !Array.isArray(payload.results)
  )
    return null;
  const first: unknown = payload.results[0];
  return !first ||
    typeof first !== "object" ||
    !("formatted_address" in first) ||
    typeof first.formatted_address !== "string" ||
    !first.formatted_address.trim() ||
    first.formatted_address.length > 1000
    ? null
    : first.formatted_address;
}

/** A transient view only. No raw response, address or coordinate is saved. */
export const reverse = action({
  args: { ...point, consent: v.boolean(), language: v.string() },
  returns: geocodingResult,
  handler: async (ctx, args): Promise<Result> => {
    const user = await requireUser(ctx);
    if (!user.phoneNumber || !user.phoneNumberVerified)
      throw new ConvexError("PHONE_REQUIRED");
    if (
      !args.consent ||
      !Number.isFinite(args.lat) ||
      !Number.isFinite(args.lng) ||
      Math.abs(args.lat) > 90 ||
      Math.abs(args.lng) > 180 ||
      !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(args.language)
    )
      throw new ConvexError("VALIDATION_REQUIRED");
    const settings = geocodingEnv();
    if (!settings) return { status: "unavailable" };
    const latlng = `${String(args.lat)},${String(args.lng)}`;
    // Keyed digest prevents the saved quota marker from being a coordinate dictionary.
    const signingKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(settings.apiKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign(
      "HMAC",
      signingKey,
      new TextEncoder().encode(`${user._id}|${latlng}|${args.language}`),
    );
    const fingerprint = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const reserved = await ctx.runMutation(internal.geocoding.reserve, {
      fingerprint,
    });
    if (reserved !== "reserved") return { status: reserved };
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", latlng);
    url.searchParams.set("language", args.language);
    url.searchParams.set("key", settings.apiKey);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, 8000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok) return { status: "unavailable" };
      const address = addressFrom(await readPayload(response));
      if (!address) return { status: "no_match" };
      await requireUser(ctx);
      return {
        status: "found",
        address,
        allowAddressSave: settings.allowAddressSave,
      };
    } catch {
      return { status: "unavailable" };
    } finally {
      clearTimeout(timer);
    }
  },
});
