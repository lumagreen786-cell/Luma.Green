/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const collected = {
  operationKey: "worker-measurement-one",
  collectedGrams: 1001,
  evidenceReference: "Isolated weighing evidence",
};
beforeEach(() => {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T06:00:00Z"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function world() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const employer = await signInAs(t, "+919000000101"),
    worker = await signInAs(t, "+919000000105"),
    other = await signInAs(t, "+919000000102"),
    household = await signInAs(t, "+919000000109");
  const scope = await t.run(async (ctx) => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", "ramesh-kabadi-store"))
      .unique();
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000105"))
      .unique();
    const owner = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000109"))
      .unique();
    if (!profile || !owner || !org?.ownerProfileId)
      throw new Error("Missing isolated fixtures");
    const outsideProfile = await ctx.db
      .query("profiles")
      .withIndex("by_phone", (q) => q.eq("phone", "+919000000102"))
      .unique();
    if (!outsideProfile) throw new Error("Missing other profile");
    const { _id, _creationTime, ...otherFields } = org;
    const otherOrgId = await ctx.db.insert("orgs", {
      ...otherFields,
      slug: "isolated-other-shop",
      name: "Isolated other shop",
      ownerProfileId: outsideProfile._id,
    });
    await ctx.db.insert("memberships", {
      orgId: otherOrgId,
      profileId: outsideProfile._id,
      role: "owner",
      createdAt: Date.now(),
    });
    await ctx.db.patch("profiles", outsideProfile._id, {
      activeOrgId: otherOrgId,
    });
    const saathi = await ctx.db
      .query("saathiProfiles")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .unique();
    if (!saathi) throw new Error("Missing worker fixture");
    const jobId = await ctx.db.insert("jobs", {
      orgId: org._id,
      city: org.city,
      kind: "home_pickups",
      title: "Isolated assigned collection",
      area: org.area,
      date: "2026-10-28",
      window: "morning",
      payPaise: 50_000,
      status: "assigned",
      saathiProfileId: saathi._id,
      createdAt: Date.now(),
    });
    const bookingId = await ctx.db.insert("bookings", {
      token: "isolated-handover-source-0001",
      householdProfileId: owner._id,
      phone: "+919000000109",
      name: "Isolated household",
      mode: "pickup",
      items: [],
      orgId: org._id,
      slotDate: "2026-10-28",
      slotWindow: "morning",
      address: "Private isolated household address",
      status: "accepted",
      timeline: [
        { status: "requested", at: Date.now() - 1000 },
        { status: "accepted", at: Date.now() },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return {
      orgId: org._id,
      otherOrgId,
      employerProfileId: org.ownerProfileId,
      workerProfileId: profile._id,
      saathiProfileId: saathi._id,
      jobId,
      bookingId,
    };
  });
  return { t, employer, worker, other, household, ...scope };
}
async function physicalState(w: Awaited<ReturnType<typeof world>>) {
  return w.t.run(async (ctx) => {
    const booking = await ctx.db.get("bookings", w.bookingId);
    return {
      stock: await ctx.db
        .query("inventory")
        .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
        .take(100),
      movements: await ctx.db
        .query("inventoryMovements")
        .withIndex("by_org_material", (q) => q.eq("orgId", w.orgId))
        .take(100),
      receipt: booking?.receipt,
    };
  });
}
async function bound(w: Awaited<ReturnType<typeof world>>) {
  return w.employer.mutation(api.workerHandovers.bind, {
    jobId: w.jobId,
    bookingId: w.bookingId,
    operationKey: "source-binding-one",
  });
}
it("links actual assigned work and a canonical receipt without adding stock or declaring worker pay twice", async () => {
  const w = await world(),
    id = await bound(w);
  expect(await bound(w)).toBe(id);
  const initial = await w.worker.query(api.workerHandovers.workerBoard, {});
  expect(initial).toContainEqual(
    expect.objectContaining({
      id,
      jobId: w.jobId,
      bookingId: w.bookingId,
      canCollect: true,
    }),
  );
  const serialized = JSON.stringify(initial);
  expect(serialized).not.toContain("+919000000109");
  expect(serialized).not.toContain("Private isolated household address");
  expect(serialized).not.toContain("isolated-handover-source-0001");
  await w.worker.mutation(api.workerHandovers.recordCollected, {
    ...collected,
    handoverId: id,
  });
  await expect(
    w.employer.mutation(api.workerHandovers.acknowledge, {
      handoverId: id,
      operationKey: "acknowledgement-one",
      varianceReason: "",
    }),
  ).rejects.toThrow("HANDOVER_RECEIPT_REQUIRED");
  await w.employer.mutation(api.shop.complete, {
    bookingId: w.bookingId,
    lines: [{ materialCode: "PAPER-NEWS", grams: 1000 }],
    method: "cash",
  });
  const before = await physicalState(w);
  const preview = await w.employer.query(api.workerHandovers.employerBoard, {});
  expect(preview.rows).toContainEqual(
    expect.objectContaining({
      id,
      collectedGrams: 1001,
      receivedGrams: 1000,
      varianceGrams: -1,
      canAcknowledge: true,
    }),
  );
  await expect(
    w.employer.mutation(api.workerHandovers.acknowledge, {
      handoverId: id,
      operationKey: "acknowledgement-one",
      varianceReason: "",
    }),
  ).rejects.toThrow("HANDOVER_VARIANCE_REASON_REQUIRED");
  const ack = {
    handoverId: id,
    operationKey: "acknowledgement-one",
    varianceReason: "Recorded scale difference",
  };
  await w.employer.mutation(api.workerHandovers.acknowledge, ack);
  await w.employer.mutation(api.workerHandovers.acknowledge, ack);
  await w.worker.mutation(api.workerHandovers.recordCollected, {
    ...collected,
    handoverId: id,
  });
  const after = await physicalState(w);
  expect(after).toEqual(before);
  const saved = await w.t.run((ctx) => ctx.db.get("workerHandovers", id));
  expect(saved).toMatchObject({
    boundByProfileId: w.employerProfileId,
    collectedByProfileId: w.workerProfileId,
    acknowledgedByProfileId: w.employerProfileId,
    receivedGrams: 1000,
    varianceGrams: -1,
    receivedLines: [{ materialCode: "PAPER-NEWS", grams: 1000 }],
  });
  expect(saved?.receiptFingerprint).toMatch(/^[a-f0-9]{64}$/);
  const job = await w.t.run((ctx) => ctx.db.get("jobs", w.jobId));
  expect(job?.workerAcknowledgedAt).toBeUndefined();
  expect(job?.employerPaidAt).toBeUndefined();
  await expect(
    w.employer.mutation(api.workerHandovers.bind, {
      jobId: w.jobId,
      bookingId: w.bookingId,
      operationKey: "cannot-rebind-acknowledged",
    }),
  ).rejects.toThrow("HANDOVER_ALREADY_ACKNOWLEDGED");
  await expect(
    w.employer.mutation(api.workerHandovers.revoke, {
      handoverId: id,
      reason: "Cannot erase acknowledgement",
    }),
  ).rejects.toThrow("HANDOVER_ALREADY_ACKNOWLEDGED");
  const audits = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "workerHandovers").eq("entityId", id),
      )
      .take(20),
  );
  expect(audits.map((row) => row.action)).toEqual([
    "worker_handover.bound",
    "worker_handover.collected",
    "worker_handover.acknowledged",
  ]);
});
it("keeps identities and changed operation retries scoped to the actual employer and worker", async () => {
  const w = await world(),
    id = await bound(w);
  await expect(
    w.other.mutation(api.workerHandovers.bind, {
      jobId: w.jobId,
      bookingId: w.bookingId,
      operationKey: "other-owner-link",
    }),
  ).rejects.toThrow();
  await expect(
    w.household.mutation(api.workerHandovers.recordCollected, {
      ...collected,
      handoverId: id,
    }),
  ).rejects.toThrow("NOT_A_SAATHI");
  await expect(
    w.employer.mutation(api.workerHandovers.recordCollected, {
      ...collected,
      handoverId: id,
    }),
  ).rejects.toThrow("NOT_A_SAATHI");
  await expect(
    w.other.mutation(api.workerHandovers.acknowledge, {
      handoverId: id,
      operationKey: "foreign-owner-ack",
      varianceReason: "Isolated difference",
    }),
  ).rejects.toThrow();
  await w.worker.mutation(api.workerHandovers.recordCollected, {
    ...collected,
    handoverId: id,
  });
  await expect(
    w.worker.mutation(api.workerHandovers.recordCollected, {
      ...collected,
      handoverId: id,
      collectedGrams: 1002,
    }),
  ).rejects.toThrow("HANDOVER_REFERENCE_CONFLICT");
  await expect(
    w.employer.mutation(api.workerHandovers.bind, {
      jobId: w.jobId,
      bookingId: w.bookingId,
      operationKey: "duplicate-booking-key",
    }),
  ).rejects.toThrow("BOOKING_ALREADY_ASSIGNED");
  const otherBoard = await w.other.query(api.workerHandovers.employerBoard, {});
  expect(otherBoard.rows).toEqual([]);
});
it.each(["open_job", "other_employer", "dropoff", "sorting"] as const)(
  "rejects an ineligible source: %s",
  async (scenario) => {
    const w = await world();
    await w.t.run(async (ctx) => {
      switch (scenario) {
        case "open_job": {
          await ctx.db.patch("jobs", w.jobId, { status: "open" });
          break;
        }
        case "other_employer": {
          await ctx.db.patch("bookings", w.bookingId, { orgId: w.otherOrgId });
          break;
        }
        case "dropoff": {
          await ctx.db.patch("bookings", w.bookingId, { mode: "dropoff" });
          break;
        }
        case "sorting": {
          await ctx.db.patch("jobs", w.jobId, { kind: "yard_sorting" });
          break;
        }
      }
    });
    await expect(bound(w)).rejects.toThrow();
  },
);
it("revokes worker source access while preserving the collected evidence for the employer", async () => {
  const w = await world(),
    id = await bound(w);
  await w.worker.mutation(api.workerHandovers.recordCollected, {
    ...collected,
    handoverId: id,
  });
  await w.employer.mutation(api.workerHandovers.revoke, {
    handoverId: id,
    reason: "Wrong source selected for this work",
  });
  expect(await w.worker.query(api.workerHandovers.workerBoard, {})).toEqual([]);
  const employer = await w.employer.query(
    api.workerHandovers.employerBoard,
    {},
  );
  expect(employer.rows).toContainEqual(
    expect.objectContaining({
      id,
      collectedGrams: 1001,
      revoked: true,
      canAcknowledge: false,
    }),
  );
  await expect(
    w.worker.mutation(api.workerHandovers.recordCollected, {
      ...collected,
      handoverId: id,
    }),
  ).rejects.toThrow("HANDOVER_SOURCE_UNAVAILABLE");
  const replacement = await w.employer.mutation(api.workerHandovers.bind, {
    jobId: w.jobId,
    bookingId: w.bookingId,
    operationKey: "replacement-source-link",
  });
  expect(replacement).not.toBe(id);
});
it("denies fractional, zero, overflow and future measurements", async () => {
  const w = await world(),
    id = await bound(w);
  for (const collectedGrams of [0, 0.5, Number.MAX_SAFE_INTEGER + 1])
    await expect(
      w.worker.mutation(api.workerHandovers.recordCollected, {
        ...collected,
        handoverId: id,
        collectedGrams,
      }),
    ).rejects.toThrow("INVALID_WEIGHT");
  await w.t.run(async (ctx) => {
    await ctx.db.patch("jobs", w.jobId, { date: "2026-10-29" });
    await ctx.db.patch("bookings", w.bookingId, { slotDate: "2026-10-29" });
  });
  await expect(
    w.worker.mutation(api.workerHandovers.recordCollected, {
      ...collected,
      handoverId: id,
    }),
  ).rejects.toThrow("TOO_EARLY");
});
it.each(["org_suspended", "worker_suspended", "viewer"] as const)(
  "keeps %s access read-only",
  async (scenario) => {
    const w = await world(),
      id = await bound(w);
    await w.t.run(async (ctx) => {
      if (scenario === "org_suspended") {
        await ctx.db.patch("orgs", w.orgId, { status: "suspended" });
        return;
      }
      if (scenario === "worker_suspended") {
        await ctx.db.patch("saathiProfiles", w.saathiProfileId, {
          status: "suspended",
        });
        return;
      }
      {
        const membership = await ctx.db
          .query("memberships")
          .withIndex("by_profile_org", (q) =>
            q.eq("profileId", w.employerProfileId).eq("orgId", w.orgId),
          )
          .unique();
        if (!membership) throw new Error("Missing membership");
        await ctx.db.patch("memberships", membership._id, { role: "viewer" });
      }
    });
    const employer = await w.employer.query(
        api.workerHandovers.employerBoard,
        {},
      ),
      worker = await w.worker.query(api.workerHandovers.workerBoard, {});
    expect(employer.rows).toContainEqual(expect.objectContaining({ id }));
    expect(worker).toContainEqual(expect.objectContaining({ id }));
    if (scenario !== "viewer") expect(worker[0]?.canCollect).toBe(false);
    if (scenario === "worker_suspended") {
      return;
    }

    expect(employer.canOperate).toBe(false);
    await expect(
      w.employer.mutation(api.workerHandovers.revoke, {
        handoverId: id,
        reason: "Read-only scope cannot revoke",
      }),
    ).rejects.toThrow();
  },
);
it("removes source access after assignment or employer ownership changes", async () => {
  const w = await world(),
    id = await bound(w);
  await w.t.run((ctx) =>
    ctx.db.patch("jobs", w.jobId, { saathiProfileId: undefined }),
  );
  expect(await w.worker.query(api.workerHandovers.workerBoard, {})).toEqual([]);
  await expect(
    w.worker.mutation(api.workerHandovers.recordCollected, {
      ...collected,
      handoverId: id,
    }),
  ).rejects.toThrow("HANDOVER_SOURCE_UNAVAILABLE");
  await w.t.run(async (ctx) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_profile", (q) => q.eq("profileId", w.employerProfileId))
      .take(20);
    for (const row of memberships) await ctx.db.delete("memberships", row._id);
  });
  await expect(
    w.employer.query(api.workerHandovers.employerBoard, {}),
  ).rejects.toThrow("NO_BUSINESS");
});

it("retires a stale unacknowledged binding atomically and does not revive the old worker grant", async () => {
  const w = await world(),
    oldId = await bound(w);
  await w.worker.mutation(api.workerHandovers.recordCollected, {
    ...collected,
    handoverId: oldId,
  });
  const replacementJobId = await w.t.run(async (ctx) => {
    const old = await ctx.db.get("jobs", w.jobId);
    if (!old) throw new Error("Missing job");
    await ctx.db.patch("jobs", w.jobId, { saathiProfileId: undefined });
    const { _id, _creationTime, ...fields } = old;
    return ctx.db.insert("jobs", {
      ...fields,
      title: "Isolated replacement work",
    });
  });
  const replacement = await w.employer.mutation(api.workerHandovers.bind, {
    jobId: replacementJobId,
    bookingId: w.bookingId,
    operationKey: "replacement-binding-new-job",
  });
  const old = await w.t.run((ctx) => ctx.db.get("workerHandovers", oldId));
  expect(old).toMatchObject({
    collectedGrams: 1001,
    revocationReason: "source_changed",
  });
  expect(old?.revokedAt).toBeDefined();
  await w.t.run((ctx) =>
    ctx.db.patch("jobs", w.jobId, { saathiProfileId: w.saathiProfileId }),
  );
  const rows = await w.worker.query(api.workerHandovers.workerBoard, {});
  expect(rows.map((row) => row.id)).toEqual([replacement]);
  const audit = await w.t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "workerHandovers").eq("entityId", oldId),
      )
      .take(10),
  );
  expect(audit.map((row) => row.action)).toContain(
    "worker_handover.source_retired",
  );
});

it("does not acknowledge an unsafe receipt total or store a partial snapshot", async () => {
  const w = await world(),
    id = await bound(w);
  await w.worker.mutation(api.workerHandovers.recordCollected, {
    ...collected,
    handoverId: id,
  });
  await w.t.run((ctx) =>
    ctx.db.patch("bookings", w.bookingId, {
      status: "completed",
      receipt: {
        lines: [
          {
            materialCode: "PAPER-NEWS",
            grams: Number.MAX_SAFE_INTEGER,
            paisePerKg: 1,
            paise: 0,
          },
          { materialCode: "PAPER-CARTON", grams: 1, paisePerKg: 1, paise: 0 },
        ],
        totalPaise: 0,
        method: "cash",
        paidAt: Date.now(),
      },
    }),
  );
  await expect(
    w.employer.mutation(api.workerHandovers.acknowledge, {
      handoverId: id,
      operationKey: "unsafe-source-ack",
      varianceReason: "Unsafe source rejected",
    }),
  ).rejects.toThrow("INVALID_WEIGHT");
  const saved = await w.t.run((ctx) => ctx.db.get("workerHandovers", id));
  expect(saved?.acknowledgedAt).toBeUndefined();
  expect(saved?.receiptFingerprint).toBeUndefined();
});
