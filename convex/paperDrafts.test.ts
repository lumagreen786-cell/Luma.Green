/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, components, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signInAs,
} from "./lib/auth.testing";
import * as paperSources from "./lib/paperSources";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
const image = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  ),
  (c) => c.codePointAt(0) ?? 0,
).buffer;
async function world() {
  vi.useFakeTimers();
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  return {
    t,
    shop: await signInAs(t, "+919000000101"),
    other: await signInAs(t, "+919000000103"),
  };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("keeps manual confirmation private, immutable and separate from stock", async () => {
  const { t, shop, other } = await world();
  vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "false");
  expect(await shop.query(api.paperDrafts.availability, {})).toMatchObject({
    assisted: false,
    canOperate: true,
  });
  const draft = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "paper.png",
    contentType: "image/png",
    bytes: image,
  });
  await expect(
    other.query(api.paperDrafts.get, { draftId: draft.draftId }),
  ).rejects.toThrow("PAPER_NOT_FOUND");
  await expect(
    t.query(api.paperDrafts.get, { draftId: draft.draftId }),
  ).rejects.toThrow();
  const before = await t.run((ctx) => ctx.db.query("inventory").collect());
  const result = await shop.mutation(api.paperDrafts.confirm, {
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    content: { text: "Reviewed 12? kg", rows: [] },
    confirmed: true,
  });
  expect(result.status).toBe("confirmed");
  expect(await t.run((ctx) => ctx.db.query("inventory").collect())).toEqual(
    before,
  );
  await expect(
    shop.mutation(api.paperDrafts.save, {
      draftId: draft.draftId,
      expectedRevision: result.revision,
      content: { text: "Changed", rows: [] },
    }),
  ).rejects.toThrow("PAPER_CONFIRMED");
  const saved = await shop.query(api.paperDrafts.get, {
    draftId: draft.draftId,
  });
  expect(saved.reviewedContent?.text).toBe("Reviewed 12? kg");
  expect(saved.sha256).toHaveLength(64);
});
it("requires image consent, counts one paid attempt, preserves model and correction separately", async () => {
  const { t, shop } = await world();
  vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "true");
  vi.stubEnv("PAPER_TRANSCRIPTION_DAILY_LIMIT", "1");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "approved/model");
  const draft = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "model.png",
    contentType: "image/png",
    bytes: image,
  });
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ text: "Untrusted 123", rows: [] }),
          },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    shop.action(api.paperDrafts.extract, { ...draft, consent: false } as never),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  const result = await shop.action(api.paperDrafts.extract, {
    draftId: draft.draftId,
    expectedRevision: draft.revision,
    consent: true,
  });
  expect(result.status).toBe("ok");
  const extracted = await shop.query(api.paperDrafts.get, {
    draftId: draft.draftId,
  });
  expect(extracted.extractedContent?.text).toBe("Untrusted 123");
  await shop.mutation(api.paperDrafts.confirm, {
    draftId: draft.draftId,
    expectedRevision: extracted.revision,
    content: { text: "Corrected 128", rows: [] },
    confirmed: true,
  });
  const confirmed = await shop.query(api.paperDrafts.get, {
    draftId: draft.draftId,
  });
  expect(confirmed.extractedContent?.text).toBe("Untrusted 123");
  expect(confirmed.reviewedContent?.text).toBe("Corrected 128");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const audits = await t.run((ctx) => ctx.db.query("auditLog").collect());
  expect(
    JSON.stringify(audits.filter((row) => row.action.startsWith("paper."))),
  ).not.toContain("Untrusted 123");
});
it("denies viewer changes, suspended reads, removed members and forged source IDs", async () => {
  const { t, shop } = await world();
  const draft = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "roles.png",
    contentType: "image/png",
    bytes: image,
  });
  const owner = await t.run(async (ctx) => {
    const row = await ctx.db.get("paperDrafts", draft.draftId);
    if (!row) throw new Error("fixture");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_profile_org", (q) =>
        q.eq("profileId", row.createdBy).eq("orgId", row.orgId),
      )
      .unique();
    if (!membership) throw new Error("fixture");
    return { row, membership };
  });
  await t.run((ctx) => ctx.db.patch(owner.membership._id, { role: "viewer" }));
  expect(
    await shop.query(api.paperDrafts.get, { draftId: draft.draftId }),
  ).toMatchObject({ id: draft.draftId });
  await expect(
    shop.mutation(api.paperDrafts.confirm, {
      draftId: draft.draftId,
      expectedRevision: 1,
      content: { text: "x", rows: [] },
      confirmed: true,
    }),
  ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
  await t.run((ctx) => ctx.db.patch(owner.row.orgId, { status: "suspended" }));
  await expect(
    shop.query(api.paperDrafts.get, { draftId: draft.draftId }),
  ).rejects.toThrow();
  await t.run(async (ctx) => {
    await ctx.db.patch(owner.row.orgId, { status: "active" });
    await ctx.db.delete(owner.membership._id);
  });
  await expect(
    shop.action(api.paperDrafts.read, { draftId: draft.draftId }),
  ).rejects.toThrow();
  await expect(
    shop.query(api.paperDrafts.get, { draftId: "forged-storage-id" as never }),
  ).rejects.toThrow();
});
it("protects raw source bytes at HTTP/session seam and revokes subsequent reads", async () => {
  const { t, shop, other } = await world();
  const draft = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "source.png",
    contentType: "image/png",
    bytes: image,
  });
  const response = await shop.fetch(`/paper-files/${draft.draftId}`);
  expect(response.status).toBe(200);
  expect(await response.arrayBuffer()).toEqual(image);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await t.fetch(`/paper-files/${draft.draftId}`)).toHaveProperty(
    "status",
    401,
  );
  expect(await other.fetch(`/paper-files/${draft.draftId}`)).toHaveProperty(
    "status",
    404,
  );
  await shop.mutation(api.paperDrafts.discard, {
    draftId: draft.draftId,
    expectedRevision: 1,
  });
  expect(await shop.fetch(`/paper-files/${draft.draftId}`)).toHaveProperty(
    "status",
    404,
  );
});
it("reserves concurrency once and blocks stale results without overwriting manual evidence", async () => {
  const { t, shop } = await world();
  vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "true");
  vi.stubEnv("PAPER_TRANSCRIPTION_DAILY_LIMIT", "1");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "approved/model");
  const draft = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "race.png",
    contentType: "image/png",
    bytes: image,
  });
  const record = await t.run((ctx) => ctx.db.get("paperDrafts", draft.draftId));
  if (!record) throw new Error("fixture");
  const args = {
    draftId: draft.draftId,
    expectedRevision: 1,
    orgId: record.orgId,
    model: "approved/model",
    dailyLimit: 1,
    attemptId: "one",
  };
  const states = await Promise.all([
    shop.mutation(internal.paperDrafts.reserveExtraction, args),
    shop.mutation(internal.paperDrafts.reserveExtraction, {
      ...args,
      attemptId: "two",
    }),
  ]);
  expect(states.toSorted((a, b) => a.localeCompare(b))).toEqual([
    "busy",
    "reserved",
  ]);
  const quotas = await t.run((ctx) =>
    ctx.db.query("paperTranscriptionQuota").collect(),
  );
  expect(quotas[0].attempts).toHaveLength(1);
  await expect(
    shop.mutation(internal.paperDrafts.finishExtraction, {
      draftId: draft.draftId,
      expectedRevision: 0,
      orgId: record.orgId,
      attemptId: "one",
      content: { text: "stale", rows: [] },
    }),
  ).rejects.toThrow("PAPER_REVISION_CONFLICT");
  await vi.advanceTimersByTimeAsync(30_001);
  await t.finishInProgressScheduledFunctions();
  const current = await shop.query(api.paperDrafts.get, {
    draftId: draft.draftId,
  });
  expect(current.extractionStatus).toBe("failed");
  await shop.mutation(api.paperDrafts.save, {
    draftId: draft.draftId,
    expectedRevision: current.revision,
    content: { text: "manual", rows: [] },
  });
  await expect(
    shop.mutation(internal.paperDrafts.finishExtraction, {
      draftId: draft.draftId,
      expectedRevision: 1,
      orgId: record.orgId,
      attemptId: "one",
      content: { text: "late", rows: [] },
    }),
  ).rejects.toThrow("PAPER_REVISION_CONFLICT");
  expect(
    await shop.query(api.paperDrafts.get, { draftId: draft.draftId }),
  ).toMatchObject({ reviewedContent: { text: "manual" } });
});
it("counts failed provider attempts and retains confirmed source through expiry", async () => {
  const { t, shop } = await world();
  vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "true");
  vi.stubEnv("PAPER_TRANSCRIPTION_DAILY_LIMIT", "1");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "approved/model");
  const draft = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "failed.png",
    contentType: "image/png",
    bytes: image,
  });
  const fetcher = vi
    .fn()
    .mockRejectedValue(new Error("private raw provider body"));
  vi.stubGlobal("fetch", fetcher);
  const args = {
    draftId: draft.draftId,
    expectedRevision: 1,
    consent: true as const,
  };
  expect(await shop.action(api.paperDrafts.extract, args)).toEqual({
    status: "failed",
    draftId: draft.draftId,
  });
  expect(
    await shop.action(api.paperDrafts.extract, {
      ...args,
      expectedRevision: 2,
    }),
  ).toMatchObject({ status: "already_attempted" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await shop.mutation(api.paperDrafts.confirm, {
    draftId: draft.draftId,
    expectedRevision: 2,
    content: { text: "Manual correction", rows: [] },
    confirmed: true,
  });
  await t.run((ctx) =>
    ctx.db.patch(draft.draftId, { expiresAt: Date.now() - 1 }),
  );
  await t.mutation(internal.paperDrafts.expire, { draftId: draft.draftId });
  const original = await shop.action(api.paperDrafts.read, {
    draftId: draft.draftId,
  });
  expect(original.bytes).toEqual(image);
});
it("checks stored session expiry instead of trusting an old signed identity", async () => {
  const { t, shop } = await world();
  const draft = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "session.png",
    contentType: "image/png",
    bytes: image,
  });
  const identity = await shop.run((ctx) => ctx.auth.getUserIdentity());
  if (typeof identity?.sessionId !== "string") throw new Error("fixture");
  const sessionId = identity.sessionId;
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "session",
        where: [{ field: "_id", value: sessionId }],
        update: { expiresAt: Date.now() - 1 },
      },
    }),
  );
  const denied = await shop.fetch(`/paper-files/${draft.draftId}`);
  expect(denied.status).toBe(401);
  await expect(
    shop.action(api.paperDrafts.read, { draftId: draft.draftId }),
  ).rejects.toThrow("NOT_SIGNED_IN");
});
it.each(["deployment", "account", "workspace"] as const)(
  "enforces the %s budget before provider execution",
  async (kind) => {
    const { t, shop } = await world();
    vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "true");
    vi.stubEnv(
      "PAPER_TRANSCRIPTION_DAILY_LIMIT",
      kind === "deployment" ? "1" : "100",
    );
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "approved/model");
    const draft = await shop.action(api.paperDrafts.upload, {
      expectedOrgId: await selectedOrg(shop),
      name: "quota.png",
      contentType: "image/png",
      bytes: image,
    });
    await t.run(async (ctx) => {
      const record = await ctx.db.get("paperDrafts", draft.draftId);
      if (!record) throw new Error("fixture");
      const other = await ctx.db
        .query("profiles")
        .filter((q) => q.neq(q.field("_id"), record.createdBy))
        .first();
      if (!other) throw new Error("fixture");
      const quota = await ctx.db.query("paperTranscriptionQuota").first();
      if (!quota) throw new Error("fixture");
      const counts = { workspace: 10, account: 3, deployment: 1 };
      const count = counts[kind];
      await ctx.db.patch(quota._id, {
        attempts: Array.from({ length: count }, () => ({
          profileId: kind === "workspace" ? other._id : record.createdBy,
          orgId: record.orgId,
          draftId: record._id,
        })),
      });
    });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(
      await shop.action(api.paperDrafts.extract, {
        draftId: draft.draftId,
        expectedRevision: 1,
        consent: true,
      }),
    ).toMatchObject({ status: "limited" });
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it("retains the attempted-source guard after draft discard and re-upload", async () => {
  const { t, shop } = await world();
  vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "true");
  vi.stubEnv("PAPER_TRANSCRIPTION_DAILY_LIMIT", "5");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "approved/model");
  const draft = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "once.png",
    contentType: "image/png",
    bytes: image,
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("failure")));
  await shop.action(api.paperDrafts.extract, {
    draftId: draft.draftId,
    expectedRevision: 1,
    consent: true,
  });
  await shop.mutation(api.paperDrafts.discard, {
    draftId: draft.draftId,
    expectedRevision: 2,
  });
  const again = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "once.png",
    contentType: "image/png",
    bytes: image,
  });
  expect(
    await shop.action(api.paperDrafts.extract, {
      draftId: again.draftId,
      expectedRevision: 1,
      consent: true,
    }),
  ).toMatchObject({ status: "already_attempted" });
  const claims = await t.run((ctx) =>
    ctx.db.query("paperExtractionClaims").collect(),
  );
  expect(claims).toHaveLength(1);
});

it("denies an upload if selected workspace changed after the picker captured its owner", async () => {
  const { t, shop, other } = await world();
  const original = await shop.query(internal.paperDrafts.currentScope, {});
  const destination = await other.query(internal.paperDrafts.currentScope, {});
  const before = await t.run((ctx) =>
    ctx.db.system.query("_storage").collect(),
  );
  await t.run(async (ctx) => {
    await ctx.db.insert("memberships", {
      profileId: original.profileId,
      orgId: destination.orgId,
      role: "member",
      createdAt: Date.now(),
    });
    await ctx.db.patch(original.profileId, { activeOrgId: destination.orgId });
  });
  await expect(
    shop.action(api.paperDrafts.upload, {
      expectedOrgId: original.orgId,
      name: "paper.png",
      contentType: "image/png",
      bytes: image,
    }),
  ).rejects.toThrow("PAPER_WORKSPACE_CHANGED");
  expect(await t.run((ctx) => ctx.db.query("paperDrafts").collect())).toEqual(
    [],
  );
  expect(
    await t.run((ctx) => ctx.db.system.query("_storage").collect()),
  ).toEqual(before);
});

async function selectedOrg(client: Awaited<ReturnType<typeof signInAs>>) {
  const result = await client.query(internal.paperDrafts.currentScope, {});
  return result.orgId;
}
it("rolls back source chunks, usage and draft if upload terminates before attachment", async () => {
  const { t, shop } = await world();
  const before = await t.run((ctx) =>
    ctx.db.system.query("_storage").collect(),
  );
  const original = paperSources.retainPaperSource;
  const interrupted = vi
    .spyOn(paperSources, "retainPaperSource")
    .mockImplementationOnce(async (ctx, args) => {
      await original(ctx, args);
      throw new Error("SIMULATED_TERMINATION_AFTER_CHUNKS");
    });
  await expect(
    shop.action(api.paperDrafts.upload, {
      expectedOrgId: await selectedOrg(shop),
      name: "atomic.png",
      contentType: "image/png",
      bytes: image,
    }),
  ).rejects.toThrow("SIMULATED_TERMINATION_AFTER_CHUNKS");
  interrupted.mockRestore();
  for (const table of [
    "paperDrafts",
    "paperSourceChunks",
    "paperSourceUsage",
    "paperTranscriptionQuota",
  ] as const)
    expect(await t.run((ctx) => ctx.db.query(table).collect())).toEqual([]);
  expect(
    await t.run((ctx) => ctx.db.system.query("_storage").collect()),
  ).toEqual(before);
  const saved = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "atomic.png",
    contentType: "image/png",
    bytes: image,
  });
  expect(
    await shop.action(api.paperDrafts.read, { draftId: saved.draftId }),
  ).toMatchObject({ bytes: image });
});
it.each(["bytes", "records"] as const)(
  "rejects retained %s capacity without changing confirmed evidence",
  async (limit) => {
    const { t, shop } = await world();
    const saved = await shop.action(api.paperDrafts.upload, {
      expectedOrgId: await selectedOrg(shop),
      name: "kept.png",
      contentType: "image/png",
      bytes: image,
    });
    await shop.mutation(api.paperDrafts.confirm, {
      draftId: saved.draftId,
      expectedRevision: 1,
      content: { text: "confirmed", rows: [] },
      confirmed: true,
    });
    await t.run(async (ctx) => {
      const usage = await ctx.db.query("paperSourceUsage").first();
      if (!usage) throw new Error("fixture");
      await ctx.db.patch(
        usage._id,
        limit === "bytes"
          ? { usedBytes: paperSources.PAPER_SOURCE_MAX_BYTES }
          : { sourceCount: 100 },
      );
    });
    const before = await t.run((ctx) =>
      ctx.db.query("paperSourceUsage").collect(),
    );
    await expect(
      shop.action(api.paperDrafts.upload, {
        expectedOrgId: await selectedOrg(shop),
        name: "new.png",
        contentType: "image/png",
        bytes: anotherImage(),
      }),
    ).rejects.toThrow("PAPER_CAPACITY");
    expect(
      await t.run((ctx) => ctx.db.query("paperSourceUsage").collect()),
    ).toEqual(before);
    expect(
      await shop.action(api.paperDrafts.read, { draftId: saved.draftId }),
    ).toMatchObject({ bytes: image });
  },
);
it("deletes only expired unconfirmed chunks and releases capacity exactly once", async () => {
  const { t, shop, other } = await world();
  const saved = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "expired.png",
    contentType: "image/png",
    bytes: image,
  });
  const kept = await other.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(other),
    name: "kept.png",
    contentType: "image/png",
    bytes: image,
  });
  await other.mutation(api.paperDrafts.confirm, {
    draftId: kept.draftId,
    expectedRevision: 1,
    content: { text: "keep", rows: [] },
    confirmed: true,
  });
  const unrelated = await t.run((ctx) =>
    ctx.storage.store(new Blob(["unrelated source"])),
  );
  await t.run((ctx) =>
    ctx.db.patch(saved.draftId, { expiresAt: Date.now() - 1 }),
  );
  await t.mutation(internal.paperDrafts.expire, { draftId: saved.draftId });
  await t.mutation(internal.paperDrafts.expire, { draftId: saved.draftId });
  await t.mutation(internal.paperDrafts.expire, { draftId: kept.draftId });
  const all = await t.run((ctx) => ctx.db.query("paperSourceChunks").collect());
  expect(all).toHaveLength(1);
  expect(all[0].draftId).toBe(kept.draftId);
  const usage = await t.run((ctx) =>
    ctx.db.query("paperSourceUsage").collect(),
  );
  expect(usage.map((row) => row.sourceCount).toSorted((a, b) => a - b)).toEqual(
    [0, 1],
  );
  expect(
    await other.action(api.paperDrafts.read, { draftId: kept.draftId }),
  ).toMatchObject({ bytes: image });
  expect(await t.run((ctx) => ctx.db.system.get(unrelated))).not.toBeNull();
});
function anotherImage() {
  const copy = new Uint8Array(image);
  copy[49] = copy[49] === 0 ? 1 : 0;
  return copy.buffer;
}
it("refuses forged chunk ownership without reading or deleting another source", async () => {
  const { t, shop, other } = await world();
  const first = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "first.png",
    contentType: "image/png",
    bytes: image,
  });
  const second = await other.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(other),
    name: "second.png",
    contentType: "image/png",
    bytes: image,
  });
  const source = await t.run((ctx) =>
    ctx.db.get("paperDrafts", second.draftId),
  );
  if (!source) throw new Error("fixture");
  await t.run((ctx) =>
    ctx.db.patch(first.draftId, {
      chunkIds: source.chunkIds,
      expiresAt: Date.now() - 1,
    }),
  );
  await expect(
    t.mutation(internal.paperDrafts.expire, { draftId: first.draftId }),
  ).rejects.toThrow("PAPER_SOURCE_INTEGRITY");
  expect(
    await other.action(api.paperDrafts.read, { draftId: second.draftId }),
  ).toMatchObject({ bytes: image });
  expect(
    await t.run((ctx) => ctx.db.query("paperSourceChunks").collect()),
  ).toHaveLength(2);
});
it("preserves a maximum-size original in four bounded chunks and frees its exact budget", async () => {
  const { t, shop } = await world();
  const large = largePaperImage(2 * 1024 * 1024);
  const saved = await shop.action(api.paperDrafts.upload, {
    expectedOrgId: await selectedOrg(shop),
    name: "large.png",
    contentType: "image/png",
    bytes: large,
  });
  const chunks = await t.run((ctx) =>
    ctx.db.query("paperSourceChunks").collect(),
  );
  expect(chunks).toHaveLength(4);
  expect(chunks.every((row) => row.bytes.byteLength <= 512 * 1024)).toBe(true);
  const source = await shop.action(api.paperDrafts.read, {
    draftId: saved.draftId,
  });
  expect(source.bytes).toEqual(large);
  await shop.mutation(api.paperDrafts.discard, {
    draftId: saved.draftId,
    expectedRevision: 1,
  });
  await t.mutation(internal.paperDrafts.expire, { draftId: saved.draftId });
  expect(
    await t.run((ctx) => ctx.db.query("paperSourceChunks").collect()),
  ).toEqual([]);
  const usage = await t.run((ctx) => ctx.db.query("paperSourceUsage").first());
  expect(usage).toMatchObject({ usedBytes: 0, sourceCount: 0 });
});
/** Synthetic1px PNG with valid private text metadata; no live paper or OCR claim. */
function largePaperImage(size: number) {
  const source = new Uint8Array(image);
  const length = size - source.length - 12;
  const payload = new Uint8Array(length).fill(65);
  payload.set([109, 101, 109, 111, 0]);
  const chunk = new Uint8Array(length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, length);
  chunk.set([116, 69, 88, 116], 4);
  chunk.set(payload, 8);
  let crc = 0xff_ff_ff_ff;
  const checksummedBytes = chunk.subarray(4, -4);
  for (const byte of checksummedBytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xed_b8_83_20 : 0);
  }
  view.setUint32(chunk.length - 4, (crc ^ 0xff_ff_ff_ff) >>> 0);
  const result = new Uint8Array(size);
  result.set(source.subarray(0, 33));
  result.set(chunk, 33);
  result.set(source.subarray(33), 33 + chunk.length);
  return result.buffer;
}
