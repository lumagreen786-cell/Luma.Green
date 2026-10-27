/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T06:30:00Z"));
  vi.stubEnv("AUTH_DEV_MODE", "true");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function world() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const employer = await signInAs(t, "+919000000101"),
    household = await signInAs(t, "+919000000109"),
    worker = await signInAs(t, "+919000000105");
  const org = await t.run((ctx) =>
    ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique(),
  );
  if (!org) throw new Error("Missing shop");
  return { t, employer, household, worker, org };
}
const input = {
  mode: "pickup" as const,
  items: [],
  slotDate: "2026-10-03",
  slotWindow: "morning" as const,
  address: "Flat 12, Mathikere, Bengaluru",
  name: "Priya Sharma",
};
describe("collection capacity and recurrence", () => {
  it("blocks holidays at booking and again at acceptance", async () => {
    const w = await world();
    await w.employer.mutation(api.collectionScheduling.saveAvailability, {
      capacityPerWindow: 20,
      holidayDates: [input.slotDate],
      enabledWindows: ["morning", "afternoon", "evening"],
    });
    const availability = await w.t.query(
      api.collectionScheduling.availability,
      { orgId: w.org._id, date: input.slotDate },
    );
    expect(availability.every((s) => s.remaining === 0)).toBe(true);
    await expect(
      w.household.mutation(api.households.book, {
        ...input,
        items: [{ materialCode: "PAPER-NEWS", kg: 1 }],
        orgId: w.org._id,
      }),
    ).rejects.toThrow("SLOT_UNAVAILABLE");
    const booking = await w.t.run(async (ctx) => {
      const householdProfile = await ctx.db
        .query("profiles")
        .withIndex("by_phone", (q) => q.eq("phone", "+919000000109"))
        .unique();
      const id = await ctx.db.insert("bookings", {
        token: "capacity-test",
        householdProfileId: householdProfile?._id,
        phone: "+919000000109",
        name: input.name,
        orgId: w.org._id,
        mode: "pickup",
        items: [],
        slotDate: input.slotDate,
        slotWindow: "morning",
        status: "requested",
        timeline: [{ status: "requested", at: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return id;
    });
    await expect(
      w.employer.mutation(api.shop.respond, {
        bookingId: booking,
        accept: true,
      }),
    ).rejects.toThrow("SLOT_UNAVAILABLE");
  });
  it("creates one dated visit per schedule and stops only future generation", async () => {
    const w = await world();
    const id = await w.t.run(async (ctx) => {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_phone", (q) => q.eq("phone", "+919000000109"))
        .unique();
      if (!p) throw new Error("Missing household");
      return ctx.db.insert("bookings", {
        token: "recurrence-test",
        householdProfileId: p._id,
        phone: p.phone ?? "",
        name: input.name,
        orgId: w.org._id,
        mode: "pickup",
        items: [],
        slotDate: "2026-09-26",
        slotWindow: "morning",
        status: "completed",
        timeline: [{ status: "completed", at: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    const schedule = await w.household.mutation(
      api.collectionScheduling.repeat,
      { bookingId: id, everyDays: 7 },
    );
    await w.t.mutation(internal.collectionScheduling.generate, {});
    await w.t.mutation(internal.collectionScheduling.generate, {});
    const visits = await w.t.run((ctx) =>
      ctx.db
        .query("bookings")
        .withIndex("by_recurring_date", (q) =>
          q.eq("recurringDateKey", `${schedule}:2026-10-03`),
        )
        .collect(),
    );
    expect(visits).toHaveLength(1);
    await w.household.mutation(api.collectionScheduling.stopRepeating, {
      id: schedule,
    });
    expect(
      await w.t.run((ctx) => ctx.db.get("bookings", visits[0]._id)),
    ).not.toBeNull();
  });
  it("keeps a worker acknowledgement separate from employer declaration", async () => {
    const w = await world();
    const jobId = await w.employer.mutation(api.workforce.post, {
      kind: "home_pickups",
      title: "Collection job",
      area: "Yeshwanthpur",
      date: "2026-10-02",
      window: "evening",
      payPaise: 45_001,
    });
    await w.worker.mutation(api.saathi.take, { jobId });
    await expect(
      w.employer.mutation(api.workforce.declarePayment, {
        jobId,
        dueDate: "2026-10-03",
      }),
    ).rejects.toThrow("WRONG_STATUS");
    await w.worker.mutation(api.saathi.finish, { jobId });
    await expect(
      w.worker.mutation(api.saathi.acknowledgePayment, { jobId }),
    ).rejects.toThrow("PAYMENT_NOT_DECLARED");
    await w.employer.mutation(api.workforce.declarePayment, {
      jobId,
      dueDate: "2026-10-03",
    });
    await w.worker.mutation(api.saathi.acknowledgePayment, { jobId });
    const job = await w.t.run((ctx) => ctx.db.get("jobs", jobId));
    expect(job).toMatchObject({
      payPaise: 45_001,
      paymentDueDate: "2026-10-03",
      employerPaidAt: Date.now(),
      workerAcknowledgedAt: Date.now(),
    });
  });
});

describe("linked support and draft retention", () => {
  it("rejects another account's source and routes payment support to accounts", async () => {
    const w = await world();
    const applicationId = await w.t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_phone", (q) => q.eq("phone", "+919000000109"))
        .unique();
      if (!profile) throw new Error("Missing profile");
      return ctx.db.insert("applications", {
        profileId: profile._id,
        kind: "saathi",
        status: "draft",
        version: 0,
        locale: "en",
        ageConfirmedAt: Date.now(),
        privacyAcceptedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    const input = {
      name: "Test Member",
      phone: "9000000109",
      role: "household" as const,
      topic: "payments" as const,
      message: "Check this payment record",
      source: { kind: "application" as const, id: applicationId },
    };
    await expect(w.worker.mutation(api.support.send, input)).rejects.toThrow(
      "RECORD_ACCESS_DENIED",
    );
    await w.household.mutation(api.support.send, input);
    const row = await w.t.run((ctx) =>
      ctx.db
        .query("supportRequests")
        .withIndex("by_source", (q) => q.eq("source", input.source))
        .unique(),
    );
    expect(row).toMatchObject({ team: "accounts", escalatedAt: Date.now() });
  });
  it("expires only never-submitted stale drafts and preserves an open linked issue", async () => {
    const w = await world();
    const ids = await w.t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_phone", (q) => q.eq("phone", "+919000000109"))
        .unique();
      if (!profile) throw new Error("Missing profile");
      const base = {
        profileId: profile._id,
        kind: "saathi" as const,
        status: "draft" as const,
        version: 0,
        locale: "en",
        ageConfirmedAt: Date.now(),
        privacyAcceptedAt: Date.now(),
        createdAt: Date.now() - 40 * 86_400_000,
        updatedAt: Date.now() - 40 * 86_400_000,
      };
      const expired = await ctx.db.insert("applications", base),
        held = await ctx.db.insert("applications", base),
        submitted = await ctx.db.insert("applications", {
          ...base,
          version: 1,
          submittedAt: Date.now() - 40 * 86_400_000,
        });
      await ctx.db.insert("supportRequests", {
        profileId: profile._id,
        name: "Test",
        phone: "+919000000109",
        role: "household",
        topic: "account",
        message: "Keep my draft while this issue is open",
        source: { kind: "application", id: held },
        status: "open",
        createdAt: Date.now(),
      });
      return { expired, held, submitted };
    });
    await w.t.mutation(internal.draftRetention.expire, {});
    expect(
      await w.t.run((ctx) => ctx.db.get("applications", ids.expired)),
    ).toBeNull();
    expect(
      await w.t.run((ctx) => ctx.db.get("applications", ids.held)),
    ).not.toBeNull();
    expect(
      await w.t.run((ctx) => ctx.db.get("applications", ids.submitted)),
    ).not.toBeNull();
  });
});

it("starts a fresh two-hour assignment round only after an explicit time change", async () => {
  const w = await world();
  const token = await w.household.mutation(api.households.book, {
    ...input,
    items: [{ materialCode: "PAPER-NEWS", kg: 1 }],
    orgId: w.org._id,
  });
  const original = await w.t.run((ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
  if (!original) throw new Error("Missing booking");
  vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
  await w.t.mutation(internal.dispatch.expireOffer, {
    bookingId: original._id,
    attempt: 1,
  });
  const expired = await w.t.run((ctx) => ctx.db.get("bookings", original._id));
  expect(expired?.status).toBe("requested");
  expect(expired?.dispatch?.expiresAt).toBeUndefined();
  const lateShop = await signInAs(w.t, "+919000000101");
  await expect(
    lateShop.mutation(api.shop.respond, {
      bookingId: original._id,
      accept: true,
    }),
  ).rejects.toThrow("WRONG_STATUS");
  const owner = await signInAs(w.t, "+919000000109");
  await owner.mutation(api.collectionScheduling.reschedule, {
    bookingId: original._id,
    date: "2026-10-05",
    window: "morning",
  });
  const changed = await w.t.run((ctx) => ctx.db.get("bookings", original._id));
  expect(changed?.createdAt).toBe(original.createdAt);
  expect(changed?.dispatch?.deadlineAt).toBe(Date.now() + 2 * 60 * 60 * 1000);
  expect(changed?.dispatch?.expiresAt).toBe(changed?.dispatch?.deadlineAt);
});
it("escalates an existing support record and retains urgent evidence once", async () => {
  const w = await world();
  const booking = await w.t.run((ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", "priyademo1"))
      .unique(),
  );
  if (!booking) throw new Error("Missing booking");
  const initial = {
    name: "Priya Sharma",
    phone: "9000000109",
    role: "household" as const,
    topic: "pickup" as const,
    message: "The collection time needs checking",
    source: { kind: "booking" as const, id: booking._id },
  };
  await w.household.mutation(api.support.send, initial);
  const urgent = {
    ...initial,
    topic: "payments" as const,
    message: "Payment was not received after collection",
  };
  await w.household.mutation(api.support.send, urgent);
  await w.household.mutation(api.support.send, urgent);
  const records = await w.t.run((ctx) =>
    ctx.db
      .query("supportRequests")
      .withIndex("by_source", (q) => q.eq("source", initial.source))
      .collect(),
  );
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    message: initial.message,
    team: "accounts",
    escalatedAt: Date.now(),
  });
  const events = await w.t.run((ctx) =>
    ctx.db
      .query("supportUpdates")
      .withIndex("by_request_created", (q) => q.eq("requestId", records[0]._id))
      .collect(),
  );
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    message: urgent.message,
    urgent: true,
    team: "accounts",
  });
});

it("applies the pickup radius at discovery, booking and acceptance while preserving manual addresses", async () => {
  const w = await world();
  const far = { lat: 12, lng: 76 };
  const listed = await w.household.query(api.households.shops, {
    items: [],
    near: far,
  });
  expect(listed.find((shop) => shop.id === w.org._id)?.offersPickup).toBe(
    false,
  );
  await expect(
    w.household.mutation(api.households.book, {
      ...input,
      items: [{ materialCode: "PAPER-NEWS", kg: 1 }],
      orgId: w.org._id,
      location: far,
    }),
  ).rejects.toThrow("OUTSIDE_PICKUP_RADIUS");
  const token = await w.household.mutation(api.households.book, {
    ...input,
    items: [{ materialCode: "PAPER-NEWS", kg: 1 }],
    orgId: w.org._id,
  });
  const row = await w.t.run((ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
  if (!row?.dispatch) throw new Error("Missing dispatch");
  expect(row.dispatch.approximateLocation).toBe(true);
  await w.t.run((ctx) =>
    ctx.db.patch("bookings", row._id, {
      dispatch: {
        ...row.dispatch,
        attempt: row.dispatch?.attempt ?? 1,
        offeredAt: row.createdAt,
        attemptedOrgIds: [row.orgId],
        origin: far,
        approximateLocation: false,
      },
    }),
  );
  await expect(
    w.employer.mutation(api.shop.respond, { bookingId: row._id, accept: true }),
  ).rejects.toThrow("OUTSIDE_PICKUP_RADIUS");
});

it("requires an admin reason and a fresh destination acceptance for reassignment", async () => {
  const w = await world();
  vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
  const admin = await signIn(w.t, {
    email: "admin@luma.test",
    twoFactorEnabled: true,
  });
  await admin.mutation(api.identity.ensureProfile, { locale: "en" });
  const candidate = await w.t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = w.org;
    const id = await ctx.db.insert("orgs", {
      ...fields,
      name: "Receiving shop",
      slug: "receiving-shop",
      autoAccept: true,
      weeklyOff: [],
      location: w.org.location,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (!fields.ownerProfileId) throw new Error("Missing owner");
    await ctx.db.insert("memberships", {
      orgId: id,
      profileId: fields.ownerProfileId,
      role: "owner",
      createdAt: Date.now(),
    });
    await ctx.db.insert("rateCards", {
      orgId: id,
      materialCode: "PAPER-NEWS",
      paisePerKg: 2500,
      updatedAt: Date.now(),
    });
    return id;
  });
  const token = await w.household.mutation(api.households.book, {
    ...input,
    items: [{ materialCode: "PAPER-NEWS", kg: 1 }],
    orgId: w.org._id,
    location: w.org.location,
  });
  const booking = await w.t.run((ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
  );
  if (!booking) throw new Error("Missing booking");
  await expect(
    w.household.query(api.adminCollections.board, {}),
  ).rejects.toThrow("NOT_ADMIN");
  const choices = await admin.query(api.adminCollections.board, {});
  const brief = choices.bookings.find((row) => row.id === booking._id);
  expect(brief).toEqual({ id: booking._id, label: expect.any(String) });
  expect(choices.shops).toContainEqual({
    id: candidate,
    label: expect.any(String),
  });
  expect(JSON.stringify(choices.bookings)).not.toContain(booking.phone);
  expect(JSON.stringify(choices.bookings)).not.toContain(input.address);
  expect(JSON.stringify(choices.bookings)).not.toContain(input.name);
  const args = {
    bookingId: booking._id,
    orgId: candidate,
    reason: "Original shop cannot attend",
  };
  await expect(
    w.household.mutation(api.adminCollections.reassign, args),
  ).rejects.toThrow("NOT_ADMIN");
  await expect(
    admin.mutation(api.adminCollections.reassign, { ...args, reason: "" }),
  ).rejects.toThrow("INVALID_REASON");
  await w.t.run((ctx) =>
    ctx.db.patch("orgs", candidate, { location: { lat: 12, lng: 76 } }),
  );
  await expect(
    admin.mutation(api.adminCollections.reassign, args),
  ).rejects.toThrow("OUTSIDE_PICKUP_RADIUS");
  await w.t.run((ctx) =>
    ctx.db.patch("orgs", candidate, { location: w.org.location }),
  );
  await admin.mutation(api.adminCollections.reassign, args);
  const offered = await w.t.run((ctx) => ctx.db.get("bookings", booking._id));
  expect(offered).toMatchObject({ orgId: candidate, status: "requested" });
  expect(offered?.dispatch?.attempt).toBe((booking.dispatch?.attempt ?? 0) + 1);
  await w.t.mutation(internal.dispatch.expireOffer, {
    bookingId: booking._id,
    attempt: booking.dispatch?.attempt ?? 1,
  });
  expect(await w.t.run((ctx) => ctx.db.get("bookings", booking._id))).toEqual(
    offered,
  );
  await expect(
    w.employer.mutation(api.shop.respond, {
      bookingId: booking._id,
      accept: true,
    }),
  ).rejects.toThrow("NOT_FOUND");
  await w.t.run(async (ctx) => {
    if (!w.org.ownerProfileId) throw new Error("Missing owner");
    await ctx.db.patch("profiles", w.org.ownerProfileId, {
      activeOrgId: candidate,
    });
  });
  await w.employer.mutation(api.shop.respond, {
    bookingId: booking._id,
    accept: true,
  });
  expect(
    await w.t.run((ctx) => ctx.db.get("bookings", booking._id)),
  ).toMatchObject({ status: "accepted" });
  const audit = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "bookings").eq("entityId", booking._id),
      )
      .collect(),
  );
  expect(
    audit.find((row) => row.action === "booking.admin_reassigned")?.metadata,
  ).toMatchObject({ reason: args.reason });
});

it("adds a receipt dispute to an existing linked support case", async () => {
  const w = await world();
  const booking = await w.t.run((ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_token", (q) => q.eq("token", "priyademo2"))
      .unique(),
  );
  if (!booking?.receipt) throw new Error("Missing receipt");
  const source = { kind: "booking" as const, id: booking._id };
  await w.household.mutation(api.support.send, {
    name: "Priya Sharma",
    phone: "9000000109",
    role: "household",
    topic: "pickup",
    message: "Please check the appointment",
    source,
  });
  const decision = {
    token: booking.token,
    receiptVersion: booking.receipt.paidAt,
    decision: "disputed" as const,
    rejectedLineIndexes: [0],
    note: "Recorded weight does not match handover",
  };
  await w.household.mutation(api.householdReceipts.review, decision);
  await w.household.mutation(api.householdReceipts.review, decision);
  const cases = await w.t.run((ctx) =>
    ctx.db
      .query("supportRequests")
      .withIndex("by_source", (q) => q.eq("source", source))
      .collect(),
  );
  expect(cases).toHaveLength(1);
  expect(cases[0]).toMatchObject({
    source,
    team: "accounts",
    escalatedAt: Date.now(),
  });
  const updates = await w.t.run((ctx) =>
    ctx.db
      .query("supportUpdates")
      .withIndex("by_request_created", (q) => q.eq("requestId", cases[0]._id))
      .collect(),
  );
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({
    message: decision.note,
    team: "accounts",
    urgent: true,
  });
});
