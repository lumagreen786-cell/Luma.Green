/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import { shiftDate } from "./lib/dates";
import { notificationConfig } from "./lib/notificationConfig";
import { queueBookingNotification } from "./lib/notifications";
import { indiaToday } from "./lib/onboarding";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const events = [
  "booking_confirmed",
  "booking_offer",
  "booking_accepted",
  "booking_reassigned",
  "application_received",
  "application_approved",
  "application_changes_requested",
  "application_rejected",
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function configure() {
  vi.stubEnv("MSG91_AUTH_KEY", "test-key");
  vi.stubEnv("SMS_NOTIFICATION_BASE_URL", "https://luma.example");
  vi.stubEnv(
    "MSG91_NOTIFICATION_TEMPLATES",
    JSON.stringify(
      Object.fromEntries(
        events.map((event) => [event, { en: `test-${event}` }]),
      ),
    ),
  );
  vi.stubEnv("MSG91_NOTIFICATION_ENGLISH_FALLBACK", "true");
}

async function world(isEnabled = false) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("MSG91_AUTH_KEY", "");
  vi.stubEnv("MSG91_NOTIFICATION_TEMPLATES", "");
  if (isEnabled) configure();
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const household = await signInAs(t, "+919000000109");
  const shop = await signInAs(t, "+919000000101");
  const org = await t.run(async (ctx) =>
    ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique(),
  );
  if (!org) throw new Error("Missing shop");
  const token = await household.mutation(api.households.book, {
    orgId: org._id,
    mode: "pickup",
    items: [{ materialCode: "PAPER-NEWS", kg: 10 }],
    slotDate: shiftDate(indiaToday(), 1),
    slotWindow: "morning",
    name: "Priya Sharma",
    address: "12, 4th Cross, Mathikere, Bengaluru",
    location: { lat: 13.028, lng: 77.5409 },
  });
  const booking = await t.run(async (ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
  if (!booking) throw new Error("Missing booking");
  const rows = () =>
    t.run(async (ctx) => ctx.db.query("smsNotifications").collect());
  const eventStatuses = async () => {
    const all = await rows();
    return all.map((row) => [row.event, row.status]);
  };
  const eventNames = async () => {
    const all = await rows();
    return all.map((row) => row.event);
  };
  const byEvent = async (event: string) => {
    const all = await rows();
    return all.find((row) => row.event === event);
  };
  const first = async () => {
    const all = await rows();
    return all.at(0);
  };
  const statusOf = async (id: Id<"smsNotifications">) => {
    const all = await rows();
    return all.find((row) => row._id === id)?.status;
  };
  const forApplication = async (id: Id<"applications">) => {
    const all = await rows();
    return all.filter((row) => row.applicationId === id);
  };
  return {
    t,
    household,
    shop,
    booking,
    rows,
    eventStatuses,
    eventNames,
    byEvent,
    first,
    statusOf,
    forApplication,
  };
}

it("commits booking and offer events with no configured service, and sends nothing", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const w = await world();
  expect(await w.eventStatuses()).toEqual([
    ["booking_confirmed", "disabled"],
    ["booking_offer", "disabled"],
  ]);
  const initialRows = await w.rows();
  for (const row of initialRows)
    await w.t.action(internal.notifications.send, { id: row._id });
  await w.shop.mutation(api.shop.respond, {
    bookingId: w.booking._id,
    accept: true,
  });
  expect(await w.eventNames()).toContain("booking_accepted");
  expect(fetcher).not.toHaveBeenCalled();
  const stored = JSON.stringify(await w.rows());
  expect(stored).not.toContain(w.booking.phone);
  expect(stored).not.toContain(w.booking.token);
});

it("deduplicates enqueue and reserves a paid send atomically across concurrent workers", async () => {
  const w = await world(true);
  await w.t.run(async (ctx) => {
    await queueBookingNotification(ctx, w.booking, "booking_confirmed");
  });
  const row = await w.byEvent("booking_confirmed");
  if (!row) throw new Error("Missing notification");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ type: "success", message: "request-id" }),
    );
  vi.stubGlobal("fetch", fetcher);
  const timeout = vi.spyOn(AbortSignal, "timeout");
  await Promise.all([
    w.t.action(internal.notifications.send, { id: row._id }),
    w.t.action(internal.notifications.send, { id: row._id }),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(timeout).toHaveBeenCalledWith(8000);
  expect(await w.statusOf(row._id)).toBe("provider_accepted");
  expect(fetcher).toHaveBeenCalledWith(
    "https://control.msg91.com/api/v5/flow",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        template_id: "test-booking_confirmed",
        short_url: "0",
        recipients: [
          {
            mobiles: w.booking.phone.slice(1),
            VAR1: `https://luma.example/en/t/${w.booking.token}`,
          },
        ],
      }),
    }),
  );
  const audit = await w.t.run(async (ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "smsNotifications").eq("entityId", row._id),
      )
      .collect(),
  );
  expect(audit.map((item) => item.action)).toEqual([
    "notification.pending",
    "notification.sending",
    "notification.provider_accepted",
  ]);
});

it.each([
  [
    "application error",
    () =>
      Promise.resolve(
        Response.json({ type: "error", message: "private provider data" }),
      ),
    "failed",
  ],
  [
    "HTTP rejection",
    () => Promise.resolve(new Response("error", { status: 400 })),
    "failed",
  ],
  [
    "HTTP server error",
    () => Promise.resolve(new Response("error", { status: 503 })),
    "unknown",
  ],
  [
    "unreadable success",
    () => Promise.resolve(new Response("not-json")),
    "unknown",
  ],
  [
    "timeout",
    () => Promise.reject(new DOMException("timed out", "TimeoutError")),
    "unknown",
  ],
] as const)(
  "does not repeat a paid side effect after %s",
  async (_name, result, status) => {
    const w = await world(true);
    const row = await w.first();
    if (!row) throw new Error("Missing event");
    const fetcher = vi.fn().mockImplementation(result);
    vi.stubGlobal("fetch", fetcher);
    await w.t.action(internal.notifications.send, { id: row._id });
    await w.t.action(internal.notifications.send, { id: row._id });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await w.statusOf(row._id)).toBe(status);
    expect(JSON.stringify(await w.rows())).not.toContain(
      "private provider data",
    );
  },
);

it("stops a queued event if configuration is removed and never revives disabled events", async () => {
  const w = await world(true);
  const row = await w.first();
  if (!row) throw new Error("Missing event");
  vi.stubEnv("MSG91_NOTIFICATION_TEMPLATES", "invalid JSON");
  expect(
    await w.t.mutation(internal.notifications.claim, { id: row._id }),
  ).toBeNull();
  configure();
  expect(
    await w.t.mutation(internal.notifications.claim, { id: row._id }),
  ).toBeNull();
  expect(await w.statusOf(row._id)).toBe("disabled");
});

it("does not send stale offers after cancellation, or reclaim a crashed send", async () => {
  const w = await world(true);
  const rows = await w.rows();
  const first = rows.at(0);
  const offer = rows.at(1);
  if (!first || !offer) throw new Error("Missing events");
  expect(
    await w.t.mutation(internal.notifications.claim, { id: first._id }),
  ).not.toBeNull();
  vi.setSystemTime(Date.now() + 60_001);
  await w.t.mutation(internal.notifications.expireClaim, { id: first._id });
  expect(await w.statusOf(first._id)).toBe("unknown");
  expect(
    await w.t.mutation(internal.notifications.claim, { id: first._id }),
  ).toBeNull();
  await w.household.mutation(api.households.cancel, { token: w.booking.token });
  expect(
    await w.t.mutation(internal.notifications.claim, { id: offer._id }),
  ).toBeNull();
  expect(await w.statusOf(offer._id)).toBe("cancelled");
});

it("requires an explicit English fallback and disables invalid settings", () => {
  configure();
  vi.stubEnv("MSG91_NOTIFICATION_ENGLISH_FALLBACK", "");
  expect(notificationConfig("booking_confirmed", "kn")).toBeNull();
  vi.stubEnv("MSG91_NOTIFICATION_ENGLISH_FALLBACK", "true");
  expect(notificationConfig("booking_confirmed", "kn")?.locale).toBe("en");
  for (const site of [
    // eslint-disable-next-line unicorn/prefer-https -- Test rejects an insecure origin.
    "http://luma.example",
    "https://user:secret@luma.example",
    "https://luma.example/?key=secret",
    "invalid",
  ]) {
    vi.stubEnv("SMS_NOTIFICATION_BASE_URL", site);
    expect(notificationConfig("booking_confirmed", "en")).toBeNull();
  }
});

it("notifies automatic activation once and rejects duplicate submissions", async () => {
  const w = await world();
  const user = await signIn(w.t, {
    email: "applicant@phone.luma.green",
    phoneNumber: "+919876543210",
  });
  await user.mutation(api.identity.ensureProfile, { locale: "kn" });
  const applicationId = await user.mutation(api.applications.start, {
    kind: "kabadiwala",
    locale: "kn",
    ageConfirmed: true,
    privacyAccepted: true,
  });
  await user.mutation(api.applications.saveDraft, {
    kabadiwala: {
      city: "Bengaluru",
      ownerName: "Ramesh K",
      shopName: "Ramesh Kabadi Store",
      gstRegistered: false,
      address: "12, 4th Cross, Yeshwanthpur, Bengaluru",
      offersPickup: false,
      phones: [],
      opens: "08:00",
      closes: "20:00",
      weeklyOff: [],
    },
  });
  await user.mutation(api.applications.submit, {});
  const rows = await w.forApplication(applicationId);
  expect(rows.map((row) => [row.event, row.locale, row.revision])).toEqual([
    ["application_approved", "kn", 1],
  ]);
  await expect(user.mutation(api.applications.submit, {})).rejects.toThrow(
    "NOT_EDITABLE",
  );
  expect(await w.forApplication(applicationId)).toHaveLength(1);
});

it("limits a recipient to 20 attempts per rolling day, including unknown outcomes", async () => {
  const w = await world(true);
  const row = await w.byEvent("booking_confirmed");
  if (!row) throw new Error("Missing event");
  await w.t.run(async (ctx) => {
    for (let index = 0; index < 20; index += 1) {
      await ctx.db.insert("smsNotifications", {
        dedupKey: `prior:${String(index)}`,
        event: "booking_confirmed",
        status: "unknown",
        profileId: row.profileId,
        locale: "en",
        revision: 1,
        bookingId: w.booking._id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attemptedAt: Date.now(),
      });
    }
  });
  expect(
    await w.t.mutation(internal.notifications.claim, { id: row._id }),
  ).toBeNull();
  expect(await w.statusOf(row._id)).toBe("rate_limited");
  // A terminal limited event stays terminal even after the rolling day.
  vi.setSystemTime(Date.now() + 86_400_001);
  expect(
    await w.t.mutation(internal.notifications.claim, { id: row._id }),
  ).toBeNull();
});

it("suppresses an offer after acceptance and suppresses an acceptance after completion", async () => {
  const w = await world(true);
  const offer = await w.byEvent("booking_offer");
  if (!offer) throw new Error("Missing offer");
  await w.shop.mutation(api.shop.respond, {
    bookingId: w.booking._id,
    accept: true,
  });
  expect(
    await w.t.mutation(internal.notifications.claim, { id: offer._id }),
  ).toBeNull();
  const accepted = await w.byEvent("booking_accepted");
  if (!accepted) throw new Error("Missing accepted event");
  await w.t.run(async (ctx) => {
    await ctx.db.patch("bookings", w.booking._id, { status: "completed" });
  });
  expect(
    await w.t.mutation(internal.notifications.claim, { id: accepted._id }),
  ).toBeNull();
  expect(await w.statusOf(offer._id)).toBe("cancelled");
  expect(await w.statusOf(accepted._id)).toBe("cancelled");
});

it("notifies the household when the shop accepts a drop-off without dispatch", async () => {
  const w = await world();
  const token = await w.household.mutation(api.households.book, {
    orgId: w.booking.orgId,
    mode: "dropoff",
    items: [{ materialCode: "PAPER-NEWS", kg: 10 }],
    slotDate: shiftDate(indiaToday(), 1),
    slotWindow: "morning",
    name: "Priya Sharma",
  });
  const booking = await w.t.run(async (ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
  if (!booking) throw new Error("Missing dropoff");
  await w.shop.mutation(api.shop.respond, {
    bookingId: booking._id,
    accept: true,
  });
  const rows = await w.rows();
  expect(
    rows.some(
      (row) =>
        row.bookingId === booking._id && row.event === "booking_accepted",
    ),
  ).toBe(true);
});
