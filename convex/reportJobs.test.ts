/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import { hashToken } from "./lib/integrations";
import { REPORT_TTL, stockCsv } from "./lib/reportJobs";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const capability = "a".repeat(64);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("TRIGGER_JOBS_ENABLED", "true");
  vi.stubEnv("TRIGGER_SECRET_KEY", "test-key");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000102");
  const other = await signInAs(t, "+919000000103");
  const selected = await owner.query(api.workspace.mine, {});
  if (selected?.kind !== "org") throw new Error("Missing workspace");
  const orgId = selected.org.id;
  const membership = await t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first(),
  );
  if (!membership) throw new Error("Missing membership");
  async function reserve(operationKey = "operation-123") {
    return owner.mutation(internal.reportJobs.reserve, {
      operationKey,
      capability,
      capabilityHash: await hashToken(capability),
    });
  }
  return { t, owner, other, orgId, membership, reserve };
}

describe("private stock report boundary", () => {
  it("creates a job through the real authenticated request action", async () => {
    const w = await world();
    const jobId = await w.owner.action(api.reportJobs.request, {
      operationKey: "real-action-123",
    });
    const job = await w.t.run((ctx) => ctx.db.get("reportJobs", jobId));
    expect(job).toMatchObject({ orgId: w.orgId, status: "queued" });
    expect(job?.capabilityHash).toMatch(/^[\da-f]{64}$/);
    const view = await w.owner.query(api.reportJobs.get, { jobId });
    expect(view).not.toHaveProperty("capabilityHash");
    expect(view).not.toHaveProperty("snapshot");
  });
  it("rejects signed-out creation and missing configuration without recording jobs", async () => {
    const w = await world();
    await expect(
      w.t.mutation(internal.reportJobs.reserve, {
        operationKey: "operation-123",
        capability,
        capabilityHash: await hashToken(capability),
      }),
    ).rejects.toThrow("NOT_SIGNED_IN");
    vi.stubEnv("TRIGGER_JOBS_ENABLED", "false");
    await expect(w.reserve()).rejects.toThrow("JOBS_UNAVAILABLE");
    expect(await w.t.run((ctx) => ctx.db.query("reportJobs").take(1))).toEqual(
      [],
    );
  });
  it("deduplicates one operation and denies a second active job", async () => {
    const w = await world();
    const jobId = await w.reserve();
    expect(await w.reserve()).toBe(jobId);
    await expect(w.reserve("operation-456")).rejects.toThrow(
      "JOB_ALREADY_PENDING",
    );
    expect(
      await w.t.run((ctx) => ctx.db.query("reportJobs").take(3)),
    ).toHaveLength(1);
  });
  it("prepares the stored snapshot, validates completion and replays without duplicate audit", async () => {
    const w = await world();
    const jobId = await w.reserve();
    const args = { jobId, capability };
    await expect(
      w.t.mutation(api.reportJobs.complete, { ...args, result: "bad" }),
    ).rejects.toThrow("INVALID_JOB_RESULT");
    const rows = await w.t.mutation(api.reportJobs.start, args);
    const result = stockCsv(rows);
    await w.t.mutation(api.reportJobs.complete, { ...args, result });
    await w.t.mutation(api.reportJobs.complete, { ...args, result });
    const completeView = await w.owner.query(api.reportJobs.get, { jobId });
    expect(completeView.result).toBe(result);
    expect(completeView.progress).toBe(100);
    const audits = await w.t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "reportJobs").eq("entityId", jobId),
        )
        .take(10),
    );
    expect(audits.map((event) => event.action)).toEqual([
      "report.queued",
      "report.running",
      "report.complete",
    ]);
    await expect(
      w.t.mutation(api.reportJobs.complete, {
        ...args,
        result: `${result}forged`,
      }),
    ).rejects.toThrow("INVALID_JOB_RESULT");
  });
  it("does not disclose another workspace or accept an altered capability", async () => {
    const w = await world();
    const jobId = await w.reserve();
    await expect(w.other.query(api.reportJobs.get, { jobId })).rejects.toThrow(
      "JOB_NOT_FOUND",
    );
    await expect(w.t.query(api.reportJobs.get, { jobId })).rejects.toThrow(
      "NOT_SIGNED_IN",
    );
    await expect(
      w.t.mutation(api.reportJobs.start, { jobId, capability: "b".repeat(64) }),
    ).rejects.toThrow("INVALID_JOB_CAPABILITY");
    await expect(
      w.t.mutation(api.reportJobs.start, { jobId, capability: "short" }),
    ).rejects.toThrow("INVALID_JOB_CAPABILITY");
  });
  it("blocks the worker and result after the requesting member is removed", async () => {
    const w = await world();
    const jobId = await w.reserve();
    const rows = await w.t.mutation(api.reportJobs.start, {
      jobId,
      capability,
    });
    await w.t.run((ctx) => ctx.db.delete("memberships", w.membership._id));
    await expect(
      w.t.mutation(api.reportJobs.complete, {
        jobId,
        capability,
        result: stockCsv(rows),
      }),
    ).rejects.toThrow("JOB_ACCESS_REVOKED");
    await expect(
      w.t.mutation(api.reportJobs.start, { jobId, capability }),
    ).rejects.toThrow("JOB_ACCESS_REVOKED");
    await expect(w.owner.query(api.reportJobs.get, { jobId })).rejects.toThrow(
      "NO_BUSINESS",
    );
  });
  it("hides expired results before the cleanup runs and then clears private data", async () => {
    const w = await world();
    const jobId = await w.reserve();
    await w.t.run((ctx) =>
      ctx.db.patch("reportJobs", jobId, {
        expiresAt: Date.now() - 1,
        result: "private",
        status: "complete",
      }),
    );
    expect(await w.owner.query(api.reportJobs.get, { jobId })).toMatchObject({
      status: "expired",
      result: null,
    });
    await expect(
      w.t.mutation(api.reportJobs.start, { jobId, capability }),
    ).rejects.toThrow("JOB_EXPIRED");
    await w.t.mutation(internal.reportJobs.expire, { jobId });
    expect(
      await w.t.run((ctx) => ctx.db.get("reportJobs", jobId)),
    ).toMatchObject({ status: "expired", snapshot: [], capabilityHash: "" });
    const expired = await w.t.run((ctx) => ctx.db.get("reportJobs", jobId));
    expect(expired?.result).toBeUndefined();
  });
  it("keeps snapshot values fixed after inventory changes", async () => {
    const w = await world();
    const jobId = await w.reserve();
    const before = await w.t.mutation(api.reportJobs.start, {
      jobId,
      capability,
    });
    await w.t.run(async (ctx) => {
      const row = await ctx.db
        .query("inventory")
        .withIndex("by_org", (q) => q.eq("orgId", w.orgId))
        .first();
      if (!row) throw new Error("No stock fixture");
      await ctx.db.patch("inventory", row._id, { grams: row.grams + 1000 });
    });
    const after = await w.t.mutation(api.reportJobs.start, {
      jobId,
      capability,
    });
    expect(after).toEqual(before);
  });
  it("still enforces the active limit when an old expiry cleanup is delayed", async () => {
    const w = await world();
    const old = await w.reserve();
    await w.t.run((ctx) =>
      ctx.db.patch("reportJobs", old, { expiresAt: Date.now() - 1 }),
    );
    await w.reserve("operation-second");
    await expect(w.reserve("operation-third")).rejects.toThrow(
      "JOB_ALREADY_PENDING",
    );
  });
  it("rejects an over-capacity snapshot instead of silently truncating", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 501; i++)
        await ctx.db.insert("inventory", {
          orgId: w.orgId,
          materialCode: `CODE-${String(i)}`,
          grams: 10,
          updatedAt: Date.now(),
        });
    });
    await expect(w.reserve()).rejects.toThrow("REPORT_TOO_LARGE");
  });
  it("enforces quota independently of operation keys and permits duplicate reads after config disable", async () => {
    const w = await world();
    const jobId = await w.reserve();
    vi.stubEnv("TRIGGER_JOBS_ENABLED", "false");
    expect(await w.reserve()).toBe(jobId);
    vi.stubEnv("TRIGGER_JOBS_ENABLED", "true");
    await w.t.run(async (ctx) => {
      await ctx.db.patch("reportJobs", jobId, { status: "failed" });
      const original = await ctx.db.get("reportJobs", jobId);
      if (!original) throw new Error("Missing job");
      for (let i = 0; i < 9; i++)
        await ctx.db.insert("reportJobs", {
          orgId: original.orgId,
          ownerProfileId: original.ownerProfileId,
          operationKey: `past-job-${String(i)}`,
          capabilityHash: "",
          status: "failed",
          snapshot: [],
          createdAt: Date.now(),
          expiresAt: Date.now() + REPORT_TTL,
        });
    });
    await expect(w.reserve("operation-new")).rejects.toThrow("JOB_DAILY_LIMIT");
  });
  it("sends one bounded request to the fixed provider and handles absent configuration", async () => {
    const w = await world();
    const jobId = await w.reserve();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    await w.t.action(internal.reportJobDispatch.dispatch, {
      jobId,
      capability,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api.trigger.dev/api/v1/tasks/private-stock-report/trigger",
    );
    const view = await w.owner.query(api.reportJobs.get, { jobId });
    expect(view.status).toBe("failed");
    vi.stubEnv("TRIGGER_JOBS_ENABLED", "false");
    await w.t.action(internal.reportJobDispatch.dispatch, {
      jobId,
      capability,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
  it("does not dispatch expired or revoked jobs and fails a queued job if config disappears", async () => {
    const w = await world();
    const jobId = await w.reserve();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("TRIGGER_JOBS_ENABLED", "false");
    await w.t.action(internal.reportJobDispatch.dispatch, {
      jobId,
      capability,
    });
    const failed = await w.owner.query(api.reportJobs.get, { jobId });
    expect(failed.status).toBe("failed");
    vi.stubEnv("TRIGGER_JOBS_ENABLED", "true");
    await w.t.run((ctx) =>
      ctx.db.patch("reportJobs", jobId, {
        status: "queued",
        expiresAt: Date.now() - 1,
      }),
    );
    await w.t.action(internal.reportJobDispatch.dispatch, {
      jobId,
      capability,
    });
    await w.t.run(async (ctx) => {
      await ctx.db.patch("reportJobs", jobId, {
        expiresAt: Date.now() + REPORT_TTL,
      });
      await ctx.db.delete("memberships", w.membership._id);
    });
    await w.t.action(internal.reportJobDispatch.dispatch, {
      jobId,
      capability,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps ambiguous dispatch available for an accepted worker and never retries transport", async () => {
    const w = await world();
    const jobId = await w.reserve();
    const fetcher = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetcher);
    await w.t.action(internal.reportJobDispatch.dispatch, {
      jobId,
      capability,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const view = await w.owner.query(api.reportJobs.get, { jobId });
    expect(view.status).toBe("queued");
    await expect(
      w.t.mutation(api.reportJobs.start, { jobId, capability }),
    ).resolves.toBeDefined();
    vi.unstubAllGlobals();
  });
  it("rejects formula codes, fractional grams and oversized operation keys", async () => {
    expect(() =>
      stockCsv([{ materialCode: "=IMPORTXML()", grams: 1 }]),
    ).toThrow("INVALID_REPORT_SOURCE");
    expect(() => stockCsv([{ materialCode: "PAPER", grams: 0.1 }])).toThrow(
      "INVALID_REPORT_SOURCE",
    );
    expect(() =>
      stockCsv([{ materialCode: "PAPER", grams: Number.MAX_SAFE_INTEGER + 1 }]),
    ).toThrow("INVALID_REPORT_SOURCE");
    const w = await world();
    await expect(w.reserve("x".repeat(81))).rejects.toThrow(
      "INVALID_OPERATION_KEY",
    );
  });
});
