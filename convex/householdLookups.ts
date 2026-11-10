import { ConvexError, v } from "convex/values";

import { householdLookupEnv } from "../src/lib/env";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import { requireUser } from "./lib/access";
import { findProfile } from "./lib/applicationAccess";
import { isValidPoint, type Point } from "./lib/households";
import { indiaToday } from "./lib/onboarding";
import { verifiedIndianMobile } from "./lib/phone";

const vLookup = v.union(v.literal("air"), v.literal("solar"));
type Lookup = "air" | "solar";
interface Air {
  status: "air";
  score: number;
  observedAt: number;
}
interface Solar {
  status: "solar";
  panelCount: number;
  annualDcKwh: number;
}
type Result = Air | Solar | { status: "unavailable" | "no_match" | "limit" };

const budgets = {
  air: { deployment: 100, account: 6, cooldownMs: 60_000 },
  solar: { deployment: 25, account: 3, cooldownMs: 300_000 },
};

export const availability = query({
  args: {},
  returns: v.object({ air: v.boolean(), solar: v.boolean() }),
  handler: () => ({
    air: householdLookupEnv("air") !== null,
    solar: householdLookupEnv("solar") !== null,
  }),
});

async function getVerifiedMember(ctx: MutationCtx) {
  const user = await requireUser(ctx);
  if (!verifiedIndianMobile(user.phoneNumber, user.phoneNumberVerified))
    throw new ConvexError("PHONE_REQUIRED");
  const profile = await findProfile(ctx, user._id);
  if (profile?.kind !== "member") throw new ConvexError("NO_PROFILE");
  return profile;
}

/** A failed provider request still spends one attempt. */
export const reserve = internalMutation({
  args: { kind: vLookup },
  returns: v.boolean(),
  handler: async (ctx, { kind }) => {
    const profile = await getVerifiedMember(ctx);
    const day = indiaToday();
    const now = Date.now();
    const read = (profileId?: typeof profile._id) =>
      ctx.db
        .query("householdLookupUsage")
        .withIndex("by_kind_profile", (q) =>
          q.eq("kind", kind).eq("profileId", profileId),
        )
        .unique();
    const [total, account] = await Promise.all([read(), read(profile._id)]);
    const totalUsed = total?.day === day ? total.used : 0;
    const accountUsed = account?.day === day ? account.used : 0;
    const budget = budgets[kind];
    if (
      totalUsed >= budget.deployment ||
      accountUsed >= budget.account ||
      (account && now - account.lastAt < budget.cooldownMs)
    )
      return false;
    if (total)
      await ctx.db.patch("householdLookupUsage", total._id, {
        day,
        used: totalUsed + 1,
        lastAt: now,
      });
    else
      await ctx.db.insert("householdLookupUsage", {
        kind,
        day,
        used: 1,
        lastAt: now,
      });
    if (account)
      await ctx.db.patch("householdLookupUsage", account._id, {
        day,
        used: accountUsed + 1,
        lastAt: now,
      });
    else
      await ctx.db.insert("householdLookupUsage", {
        kind,
        profileId: profile._id,
        day,
        used: 1,
        lastAt: now,
      });
    await ctx.db.insert("auditLog", {
      action: "household_lookup.reserved",
      entityTable: "profiles",
      entityId: profile._id,
      actorProfileId: profile._id,
      metadata: { kind, provider: "google_maps", consent: true },
      createdAt: now,
    });
    return true;
  },
});

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function airFrom(value: unknown): Air | null {
  const data = record(value);
  if (typeof data?.dateTime !== "string" || !Array.isArray(data.indexes))
    return null;
  const observedAt = Date.parse(data.dateTime);
  const now = Date.now();
  if (
    !Number.isFinite(observedAt) ||
    observedAt > now + 300_000 ||
    observedAt < now - 7_200_000
  )
    return null;
  for (const value of data.indexes as unknown[]) {
    const index = record(value);
    if (index?.code !== "uaqi") continue;
    const score = index.aqi;
    if (
      typeof score === "number" &&
      Number.isSafeInteger(score) &&
      score >= 0 &&
      score <= 100
    )
      return { status: "air", score, observedAt };
  }
  return null;
}

function corner(value: unknown): Point | null {
  const data = record(value);
  if (typeof data?.latitude !== "number" || typeof data.longitude !== "number")
    return null;
  const point = { lat: data.latitude, lng: data.longitude };
  return isValidPoint(point) ? point : null;
}

function solarFrom(value: unknown, point: Point): Solar | null {
  const data = record(value);
  const box = record(data?.boundingBox);
  const sw = corner(box?.sw);
  const ne = corner(box?.ne);
  if (
    !sw ||
    !ne ||
    point.lat < sw.lat ||
    point.lat > ne.lat ||
    point.lng < sw.lng ||
    point.lng > ne.lng
  )
    return null;
  const potential = record(data?.solarPotential);
  if (!Array.isArray(potential?.solarPanelConfigs)) return null;
  let result: Solar | null = null;
  for (const value of potential.solarPanelConfigs as unknown[]) {
    const config = record(value);
    const panels = config?.panelsCount;
    const annual = config?.yearlyEnergyDcKwh;
    if (
      typeof panels === "number" &&
      typeof annual === "number" &&
      panels > (result?.panelCount ?? 0) &&
      annual > 0 &&
      Number.isSafeInteger(panels) &&
      Number.isFinite(annual)
    )
      result = { status: "solar", panelCount: panels, annualDcKwh: annual };
  }
  return result;
}

async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  let chunk = await reader.read();
  while (!chunk.done) {
    size += chunk.value.byteLength;
    if (size > 150_000) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(chunk.value, { stream: true });
    chunk = await reader.read();
  }
  return JSON.parse(body + decoder.decode()) as unknown;
}

function providerRequest(
  kind: Lookup,
  key: string,
  point: Point,
): [URL, RequestInit] {
  if (kind === "air") {
    const url = new URL(
      "https://airquality.googleapis.com/v1/currentConditions:lookup",
    );
    url.searchParams.set("fields", "dateTime,indexes(code,aqi)");
    return [
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          location: { latitude: point.lat, longitude: point.lng },
        }),
      },
    ];
  }
  const url = new URL(
    "https://solar.googleapis.com/v1/buildingInsights:findClosest",
  );
  url.searchParams.set("location.latitude", String(point.lat));
  url.searchParams.set("location.longitude", String(point.lng));
  url.searchParams.set("requiredQuality", "HIGH");
  url.searchParams.set(
    "fields",
    "boundingBox,solarPotential(solarPanelConfigs(panelsCount,yearlyEnergyDcKwh))",
  );
  return [url, { method: "GET", headers: { "X-Goog-Api-Key": key } }];
}

/** Provider data and coordinates exist only for this request and the open screen. */
export const check = action({
  args: {
    kind: vLookup,
    consent: v.boolean(),
    lat: v.number(),
    lng: v.number(),
  },
  returns: v.union(
    v.object({
      status: v.literal("air"),
      score: v.number(),
      observedAt: v.number(),
    }),
    v.object({
      status: v.literal("solar"),
      panelCount: v.number(),
      annualDcKwh: v.number(),
    }),
    v.object({
      status: v.union(
        v.literal("unavailable"),
        v.literal("no_match"),
        v.literal("limit"),
      ),
    }),
  ),
  handler: async (ctx, args): Promise<Result> => {
    const user = await requireUser(ctx);
    if (!verifiedIndianMobile(user.phoneNumber, user.phoneNumberVerified))
      throw new ConvexError("PHONE_REQUIRED");
    if (!args.consent || !isValidPoint(args))
      throw new ConvexError("VALIDATION_REQUIRED");
    const key = householdLookupEnv(args.kind);
    if (!key) return { status: "unavailable" };
    if (
      !(await ctx.runMutation(internal.householdLookups.reserve, {
        kind: args.kind,
      }))
    )
      return { status: "limit" };
    const precision = args.kind === "air" ? 3 : 5;
    const point = {
      lat: Number(args.lat.toFixed(precision)),
      lng: Number(args.lng.toFixed(precision)),
    };
    const [url, request] = providerRequest(args.kind, key, point);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 8000);
    try {
      const response = await fetch(url, {
        ...request,
        signal: controller.signal,
        redirect: "error",
      });
      if (response.status === 404) return { status: "no_match" };
      if (!response.ok) return { status: "unavailable" };
      const data = await readJson(response);
      const result =
        args.kind === "air" ? airFrom(data) : solarFrom(data, point);
      await requireUser(ctx);
      return result ?? { status: "no_match" };
    } catch {
      return { status: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  },
});
