/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import {
  QUALITY_MAX_BYTES,
  validateQualityContent,
} from "./lib/qualityContent";
import { mockR2 } from "./lib/r2.testing";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
const pdf = () =>
  new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF",
  ).buffer;
async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const owner = await signInAs(t, "+919000000102");
  const buyer = await signInAs(t, "+919000000103");
  const stranger = await signInAs(t, "+919000000101");
  const buyerOrg = await buyer.query(api.traceability.mine, {});
  const buyerId = await t.run(async (ctx) => {
    const row = await ctx.db
      .query("orgs")
      .withIndex("by_kind_city", (q) =>
        q.eq("kind", "recycler").eq("city", "Bengaluru"),
      )
      .first();
    if (!row) throw new Error("fixture");
    return row._id;
  });
  const lotId = await owner.mutation(api.traceability.declareLot, {
    materialCode: "PLASTIC-PET",
    state: "bale",
    grams: 2000,
    sourceReference: "PRIVATE SOURCE",
    streamClass: "main_product",
    handlingClass: "non_hazardous",
  });
  const inspectionId = await owner.mutation(api.quality.recordInspection, {
    lotId,
    buyerOrgId: buyerId,
    specificationReference: "PET quality",
    specificationVersion: "v1",
    sampleMethod: "Composite",
    results: [{ parameter: "Moisture", unit: "percent", value: "1" }],
    decision: "accepted",
    evidenceReference: "PRIVATE REFERENCE",
  });
  const uploadArgs = {
    inspectionId,
    shareWithBuyer: true,
    kind: "coa" as const,
    name: "quality.pdf",
    contentType: "application/pdf",
    bytes: pdf(),
  };
  return {
    t,
    owner,
    buyer,
    stranger,
    lotId,
    inspectionId,
    uploadArgs,
    buyerOrg,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function reportWorld() {
  const w = await world();
  const recipient = await signIn(w.t, {
    email: "auditor@luma.test",
    phoneNumber: "+919000000306",
  });
  await recipient.mutation(api.identity.ensureProfile, { locale: "en" });
  const recipientId = await recipient.mutation(
    api.stakeholderAccounts.request,
    {
      kind: "independent_auditor",
      organizationName: "Test auditor",
      ageConfirmed: true,
      privacyAccepted: true,
    },
  );
  await w.t.run((ctx) =>
    ctx.db.patch("stakeholderAccounts", recipientId, { status: "approved" }),
  );
  const fileId = await w.owner.action(api.qualityFiles.upload, {
    ...w.uploadArgs,
    shareWithBuyer: false,
  });
  const args = {
    inspectionId: w.inspectionId,
    recipientId,
    purpose: "PET evidence review",
    expiresAt: Date.now() + 86_400_000,
    attachmentIds: [fileId],
  };
  return { ...w, recipient, recipientId, fileId, args };
}

describe("application upload isolation", () => {
  it.each(["attach", "cleanup"] as const)(
    "does not let application %s claim or delete a quality attachment",
    async (operation) => {
      const w = await world();
      const fileId = await w.owner.action(
        api.qualityFiles.upload,
        w.uploadArgs,
      );
      const file = await w.t.run((ctx) =>
        ctx.db.get("qualityAttachments", fileId),
      );
      if (!file?.storageId) throw new Error("Missing storage fixture");
      const storageId = file.storageId;
      const applicant = await signIn(w.t, {
        email: "applicant@luma.test",
        phoneNumber: "+919000000307",
      });
      await applicant.mutation(api.identity.ensureProfile, { locale: "en" });
      await applicant.mutation(api.applications.start, {
        kind: "yard",
        locale: "en",
        ageConfirmed: true,
        privacyAccepted: true,
      });
      if (operation === "attach")
        await expect(
          applicant.action(api.applicationFiles.attach, {
            storageId,
            type: "pcb_certificate",
            name: "claimed.pdf",
          }),
        ).rejects.toThrow("FILE_IN_USE");
      else
        await applicant.mutation(internal.applicationFiles.discardUnattached, {
          storageId,
        });
      expect(
        await w.t.run(
          async (ctx) => (await ctx.storage.get(storageId)) !== null,
        ),
      ).toBe(true);
    },
  );
});

describe.each(["convex", "r2"])("quality storage: %s", (provider) => {
  beforeEach(() => {
    if (provider === "r2") mockR2();
  });
  describe("quality files and buyer decisions", () => {
    it("keeps inspection immutable, makes explicit buyer decisions and hides bytes from list queries", async () => {
      const w = await world();
      const before = await w.t.run((ctx) =>
        ctx.db.get("lotInspections", w.inspectionId),
      );
      const id = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
      const board = await w.buyer.query(api.qualityFiles.board, {});
      expect(board.incoming).toHaveLength(1);
      expect(board.incoming[0]).not.toHaveProperty("storageId");
      await w.buyer.mutation(api.qualityFiles.decide, {
        inspectionId: w.inspectionId,
        attachmentIds: [id],
        decision: "conditional",
        note: "Please resample",
      });
      const seller = await w.owner.query(api.qualityFiles.board, {});
      expect(seller.decisions[0]?.decision).toBe("conditional");
      expect(
        await w.t.run((ctx) => ctx.db.get("lotInspections", w.inspectionId)),
      ).toEqual(before);
      expect(
        await w.stranger.query(internal.qualityFiles.readFile, { fileId: id }),
      ).toBeNull();
      expect(
        await w.buyer.query(internal.qualityFiles.readFile, { fileId: id }),
      ).not.toBeNull();
    });
    it("does not share files with a buyer unless explicitly selected, and rejects foreign uploads", async () => {
      const w = await world();
      const id = await w.owner.action(api.qualityFiles.upload, {
        ...w.uploadArgs,
        shareWithBuyer: false,
      });
      expect(
        await w.buyer.query(internal.qualityFiles.readFile, { fileId: id }),
      ).toBeNull();
      await expect(
        w.stranger.action(api.qualityFiles.upload, w.uploadArgs),
      ).rejects.toThrow("INSPECTION_NOT_FOUND");
      await expect(
        w.buyer.mutation(api.qualityFiles.decide, {
          inspectionId: w.inspectionId,
          attachmentIds: [id],
          decision: "accepted",
          note: "Meets limits",
        }),
      ).rejects.toThrow("QUALITY_ACCESS_DENIED");
    });
    it("withdrawal blocks future buyer downloads and decisions but preserves audit evidence", async () => {
      const w = await world();
      const id = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
      await w.owner.mutation(api.qualityFiles.withdraw, { fileId: id });
      expect(
        await w.buyer.query(internal.qualityFiles.readFile, { fileId: id }),
      ).toBeNull();
      await expect(
        w.buyer.mutation(api.qualityFiles.decide, {
          inspectionId: w.inspectionId,
          attachmentIds: [id],
          decision: "accepted",
          note: "Meets limits",
        }),
      ).rejects.toThrow();
      expect(
        await w.t.run((ctx) => ctx.db.get("qualityAttachments", id)),
      ).not.toBeNull();
    });
    it("removal of workspace membership revokes downloads", async () => {
      const w = await world();
      const id = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
      await w.t.run(async (ctx) => {
        const org = await ctx.db
          .query("orgs")
          .withIndex("by_kind_city", (q) =>
            q.eq("kind", "recycler").eq("city", "Bengaluru"),
          )
          .first();
        if (!org) throw new Error("fixture");
        const m = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .first();
        if (m) await ctx.db.delete("memberships", m._id);
      });
      expect(
        await w.buyer.query(internal.qualityFiles.readFile, { fileId: id }),
      ).toBeNull();
    });
    it("refuses viewer writes and owner-only withdrawal", async () => {
      const w = await world();
      await w.t.run(async (ctx) => {
        const lot = await ctx.db.get("materialLots", w.lotId);
        if (!lot) throw new Error("fixture");
        const m = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", lot.orgId))
          .first();
        if (m) await ctx.db.patch("memberships", m._id, { role: "viewer" });
      });
      await expect(
        w.owner.action(api.qualityFiles.upload, w.uploadArgs),
      ).rejects.toThrow("WORKSPACE_PERMISSION_DENIED");
    });
    it("rejects unsafe content before storing and only discards unattached blobs", async () => {
      const w = await world();
      await expect(
        w.owner.action(api.qualityFiles.upload, {
          ...w.uploadArgs,
          bytes: new TextEncoder().encode("%PDF-1.4 /JavaScript evil %%EOF")
            .buffer,
        }),
      ).rejects.toThrow("UNSAFE_DOCUMENT");
      const id = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
      const file = await w.t.run((ctx) => ctx.db.get("qualityAttachments", id));
      if (!file) throw new Error("fixture");
      if (file.storageId) {
        const storageId = file.storageId;
        await w.t.mutation(internal.qualityFiles.discard, { storageId });
        expect(
          await w.t.run(async (ctx) =>
            Boolean(await ctx.storage.get(storageId)),
          ),
        ).toBe(true);
      } else {
        expect(file.r2).toBeDefined();
        expect(await w.t.action(internal.qualityFiles.cleanupR2, {})).toEqual({
          deleted: 0,
          failed: 0,
        });
        const response1 = await w.owner.fetch(`/quality-files/${id}`);
        expect(response1.status).toBe(200);
      }
      const orphan = await w.t.run((ctx) =>
        ctx.storage.store(new Blob([pdf()])),
      );
      await w.t.mutation(internal.qualityFiles.discard, { storageId: orphan });
      expect(
        await w.t.run(async (ctx) => {
          const blob = await ctx.storage.get(orphan);
          return Boolean(blob);
        }),
      ).toBe(false);
    });
  });
  describe("file validation", () => {
    it.each(["text/html", "image/svg+xml", "application/zip"])(
      "denies %s",
      (type) => {
        expect(() => validateQualityContent(pdf(), type)).toThrow();
      },
    );
    it("bounds bytes and rejects encrypted or incomplete PDFs", () => {
      expect(() =>
        validateQualityContent(
          new ArrayBuffer(QUALITY_MAX_BYTES + 1),
          "application/pdf",
        ),
      ).toThrow();
      for (const text of [
        "%PDF-1.4 encrypted /Encrypt true %%EOF",
        "%PDF-1.4 missing end",
      ]) {
        expect(() =>
          validateQualityContent(
            new TextEncoder().encode(text).buffer,
            "application/pdf",
          ),
        ).toThrow();
      }
    });
  });
  describe("scoped audit reports", () => {
    it("shares only effective inspections after independent correction approval", async () => {
      const w = await reportWorld();
      const original = await w.t.run((ctx) =>
        ctx.db.get("lotInspections", w.inspectionId),
      );
      if (!original) throw new Error("fixture");
      const correction = await w.owner.mutation(api.quality.proposeCorrection, {
        lotId: w.lotId,
        buyerOrgId: original.buyerOrgId,
        specificationReference: original.specificationReference,
        specificationVersion: original.specificationVersion,
        sampleMethod: original.sampleMethod,
        results: [{ parameter: "Moisture", unit: "percent", value: "99" }],
        decision: "rejected",
        supersedesInspectionId: w.inspectionId,
        reason: "Corrected laboratory measurement",
      });
      await expect(
        w.owner.mutation(api.quality.approveCorrection, {
          inspectionId: correction,
        }),
      ).rejects.toThrow("SELF_APPROVAL_FORBIDDEN");
      const correctionArgs = {
        ...w.args,
        inspectionId: correction,
        attachmentIds: [],
      };
      await expect(
        w.owner.mutation(api.auditShares.create, correctionArgs),
      ).rejects.toThrow("INSPECTION_NOT_APPROVED");
      const pending = await w.owner.query(api.auditShares.board, {});
      expect(pending.inspections.map((row) => row.id)).toContain(
        w.inspectionId,
      );
      expect(pending.inspections.map((row) => row.id)).not.toContain(
        correction,
      );
      await w.t.run(async (ctx) => {
        const shop = await ctx.db
          .query("orgs")
          .withIndex("by_kind_city", (q) =>
            q.eq("kind", "kabadiwala").eq("city", "Bengaluru"),
          )
          .first();
        if (!shop) throw new Error("fixture");
        const member = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", shop._id))
          .first();
        if (!member) throw new Error("fixture");
        await ctx.db.insert("memberships", {
          orgId: original.orgId,
          profileId: member.profileId,
          role: "owner",
          createdAt: Date.now(),
        });
        await ctx.db.patch("profiles", member.profileId, {
          activeOrgId: original.orgId,
        });
      });
      await w.stranger.mutation(api.quality.approveCorrection, {
        inspectionId: correction,
      });
      const approved = await w.owner.query(api.auditShares.board, {});
      expect(approved.inspections.map((row) => row.id)).toContain(correction);
      expect(approved.inspections.map((row) => row.id)).not.toContain(
        w.inspectionId,
      );
      await expect(
        w.owner.mutation(api.auditShares.create, w.args),
      ).rejects.toThrow("INSPECTION_SUPERSEDED");
      const reportId = await w.owner.mutation(
        api.auditShares.create,
        correctionArgs,
      );
      const report = await w.recipient.query(api.auditShares.read, {
        reportId,
      });
      expect(report?.snapshot.inspectingDecision).toBe("rejected");
    });

    it("shares only a frozen whitelist with the exact recipient, then revokes bytes and view", async () => {
      const w = await reportWorld();
      const reportId = await w.owner.mutation(api.auditShares.create, w.args);
      const read = await w.recipient.query(api.auditShares.read, { reportId });
      expect(read?.snapshot.materialCode).toBe("PLASTIC-PET");
      expect(JSON.stringify(read)).not.toContain("PRIVATE");
      expect(read?.snapshot).not.toHaveProperty("lotId");
      expect(
        await w.stranger.query(api.auditShares.read, { reportId }),
      ).toBeNull();
      expect(
        await w.recipient.query(internal.qualityFiles.readFile, {
          fileId: w.fileId,
          reportId,
        }),
      ).not.toBeNull();
      expect(
        await w.recipient.query(internal.qualityFiles.readFile, {
          fileId: w.fileId,
        }),
      ).toBeNull();
      await w.owner.mutation(api.auditShares.revoke, { reportId });
      expect(
        await w.recipient.query(api.auditShares.read, { reportId }),
      ).toBeNull();
      expect(
        await w.recipient.query(internal.qualityFiles.readFile, {
          fileId: w.fileId,
          reportId,
        }),
      ).toBeNull();
    });
    it("denies expired grants and suspended stakeholder approval", async () => {
      const w = await reportWorld();
      const reportId = await w.owner.mutation(api.auditShares.create, w.args);
      await w.t.run((ctx) =>
        ctx.db.patch("stakeholderAccounts", w.recipientId, {
          status: "rejected",
        }),
      );
      expect(
        await w.recipient.query(api.auditShares.read, { reportId }),
      ).toBeNull();
      await w.t.run(async (ctx) => {
        await ctx.db.patch("stakeholderAccounts", w.recipientId, {
          status: "approved",
        });
        await ctx.db.patch("auditReports", reportId, {
          expiresAt: Date.now() - 1,
        });
      });
      expect(
        await w.recipient.query(api.auditShares.read, { reportId }),
      ).toBeNull();
    });
    it("rejects cross-org sharing and non-approved recipients", async () => {
      const w = await reportWorld();
      await expect(
        w.stranger.mutation(api.auditShares.create, w.args),
      ).rejects.toThrow("INSPECTION_NOT_FOUND");
      await w.t.run((ctx) =>
        ctx.db.patch("stakeholderAccounts", w.recipientId, {
          status: "pending",
        }),
      );
      await expect(
        w.owner.mutation(api.auditShares.create, w.args),
      ).rejects.toThrow("RECIPIENT_NOT_APPROVED");
    });
  });

  describe("authenticated quality HTTP downloads", () => {
    it("serves exact bytes as private attachments and denies another recipient or revoked grant", async () => {
      const w = await reportWorld();
      vi.stubEnv("SITE_URL", "http://localhost:3100");
      const reportId = await w.owner.mutation(api.auditShares.create, w.args);
      const path = `/quality-files/${w.fileId}?report=${reportId}`;
      const response = await w.recipient.fetch(path, {
        headers: { Origin: "http://localhost:3100" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Content-Disposition")).toMatch(
        /^attachment;/,
      );
      expect(await response.arrayBuffer()).toEqual(pdf());
      const stranger = await w.stranger.fetch(path);
      expect(stranger.status).toBe(404);
      await w.owner.mutation(api.auditShares.revoke, { reportId });
      const revoked = await w.recipient.fetch(path);
      expect(revoked.status).toBe(404);
    });
    it("denies suspended source, withdrawn file and expired session through HTTP", async () => {
      const w = await reportWorld();
      const reportId = await w.owner.mutation(api.auditShares.create, w.args);
      const path = `/quality-files/${w.fileId}?report=${reportId}`;
      const lot = await w.t.run((ctx) => ctx.db.get("materialLots", w.lotId));
      if (!lot) throw new Error("fixture");
      await w.t.run((ctx) =>
        ctx.db.patch("orgs", lot.orgId, { status: "suspended" }),
      );
      const denied = await w.recipient.fetch(path);
      expect(denied.status).toBe(404);
      await w.t.run((ctx) =>
        ctx.db.patch("orgs", lot.orgId, { status: "active" }),
      );
      const identity = await w.recipient.run((ctx) =>
        ctx.auth.getUserIdentity(),
      );
      if (typeof identity?.sessionId !== "string") throw new Error("fixture");
      const sessionId = identity.sessionId;
      await w.t.run((ctx) =>
        ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "session",
            where: [{ field: "_id", value: sessionId }],
            update: { expiresAt: Date.now() - 1 },
          },
        }),
      );
      const expired = await w.recipient.fetch(path);
      expect(expired.status).toBe(403);
      await w.t.run((ctx) =>
        ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "session",
            where: [{ field: "_id", value: sessionId }],
            update: { expiresAt: Date.now() + 3_600_000 },
          },
        }),
      );
      await w.owner.mutation(api.qualityFiles.withdraw, { fileId: w.fileId });
      const withdrawn = await w.recipient.fetch(path);
      expect(withdrawn.status).toBe(404);
    });
    it("refuses anonymous requests and untrusted CORS preflight", async () => {
      const w = await reportWorld();
      const anonymous = await w.t.fetch(`/quality-files/${w.fileId}`);
      expect(anonymous.status).toBe(403);
      const preflight = await w.t.fetch(`/quality-files/${w.fileId}`, {
        method: "OPTIONS",
        headers: { Origin: "https://untrusted.example" },
      });
      expect(preflight.status).toBe(403);
    });
    it("snapshots actual buyer decisions without inferring acceptance or changing later", async () => {
      const w = await reportWorld();
      const shared = await w.owner.action(
        api.qualityFiles.upload,
        w.uploadArgs,
      );
      await w.buyer.mutation(api.qualityFiles.decide, {
        inspectionId: w.inspectionId,
        attachmentIds: [shared],
        decision: "conditional",
        note: "Resample required",
      });
      const reportId = await w.owner.mutation(api.auditShares.create, w.args);
      await w.buyer.mutation(api.qualityFiles.decide, {
        inspectionId: w.inspectionId,
        attachmentIds: [shared],
        decision: "accepted",
        note: "Second test accepted",
      });
      const snapshot = await w.recipient.query(api.auditShares.read, {
        reportId,
      });
      expect(snapshot?.snapshot.buyerDecisions).toHaveLength(1);
      expect(snapshot?.snapshot.buyerDecisions[0]?.decision).toBe(
        "conditional",
      );
    });
  });
});

describe("R2 lifecycle", () => {
  it("keeps old files readable, and R2 reads work with new writes off", async () => {
    const w = await world();
    const oldId = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
    const provider = mockR2();
    const newId = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
    expect(provider.objects.size).toBe(1);
    vi.stubEnv("R2_ENABLED", "false");
    for (const id of [oldId, newId]) {
      const response = await w.owner.fetch(`/quality-files/${id}`);
      expect(response.status).toBe(200);
      expect(await response.arrayBuffer()).toEqual(pdf());
    }
  });
  it("fails closed on incomplete enabled configuration without creating a file", async () => {
    const w = await world();
    vi.stubEnv("R2_ENABLED", "true");
    await expect(
      w.owner.action(api.qualityFiles.upload, w.uploadArgs),
    ).rejects.toThrow("STORAGE_UNAVAILABLE");
    const board = await w.owner.query(api.qualityFiles.board, {});
    expect(board.own).toHaveLength(0);
  });
  it("cleans ambiguous uploads after a crash, retries outages, and never deletes attached bytes", async () => {
    const w = await world();
    const provider = mockR2();
    const good = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
    const original = provider.fetcher.getMockImplementation();
    if (!original) throw new Error("fixture");
    provider.fetcher.mockImplementationOnce(async (input) => {
      await original(input);
      throw new Error("Connection lost after PUT");
    });
    await expect(
      w.owner.action(api.qualityFiles.upload, w.uploadArgs),
    ).rejects.toThrow("STORAGE_UNAVAILABLE");
    expect(provider.objects.size).toBe(2);
    const expire = async () =>
      w.t.run(async (ctx) => {
        const rows = await ctx.db.query("qualityUploads").collect();
        for (const row of rows)
          if (row.state !== "attached")
            await ctx.db.patch("qualityUploads", row._id, {
              cleanupAt: Date.now() - 1,
            });
      });
    await expire();
    provider.fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect(await w.t.action(internal.qualityFiles.cleanupR2, {})).toEqual({
      deleted: 0,
      failed: 1,
    });
    await expire();
    expect(await w.t.action(internal.qualityFiles.cleanupR2, {})).toEqual({
      deleted: 1,
      failed: 0,
    });
    expect(provider.objects.size).toBe(1);
    const response2 = await w.owner.fetch(`/quality-files/${good}`);
    expect(response2.status).toBe(200);
  });
  it("refuses corrupted R2 bytes and does not fall back to another store", async () => {
    const w = await world();
    const provider = mockR2();
    const id = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
    for (const key of provider.objects.keys())
      provider.objects.set(key, new Uint8Array(pdf().byteLength).buffer);
    const response3 = await w.owner.fetch(`/quality-files/${id}`);
    expect(response3.status).toBe(503);
    vi.stubEnv("R2_BUCKET_NAME", "wrong-bucket");
    const response4 = await w.owner.fetch(`/quality-files/${id}`);
    expect(response4.status).toBe(503);
  });
  it("rechecks membership after the external write and leaves denied uploads for cleanup", async () => {
    const w = await world();
    const provider = mockR2();
    const original = provider.fetcher.getMockImplementation();
    if (!original) throw new Error("fixture");
    provider.fetcher.mockImplementationOnce(async (input) => {
      const response = await original(input);
      await w.t.run(async (ctx) => {
        const lot = await ctx.db.get("materialLots", w.lotId);
        if (!lot) throw new Error("fixture");
        const memberships = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("orgId", lot.orgId))
          .collect();
        for (const member of memberships)
          await ctx.db.delete("memberships", member._id);
      });
      return response;
    });
    await expect(
      w.owner.action(api.qualityFiles.upload, w.uploadArgs),
    ).rejects.toThrow();
    expect(
      await w.t.run((ctx) => ctx.db.query("qualityAttachments").collect()),
    ).toHaveLength(0);
    expect(provider.objects.size).toBe(1);
  });
});

describe("R2 reservation safety", () => {
  it("reserves the final available slots before parallel object writes", async () => {
    const w = await world();
    mockR2();
    const args = {
      inspectionId: w.inspectionId,
      shareWithBuyer: true,
      r2: {
        accountId: "a".repeat(32),
        bucket: "luma-test",
        key: "quality/12345678-1234-1234-1234-123456789abc",
      },
      size: pdf().byteLength,
      sha256: "fixture",
    };
    for (let index = 0; index < 20; index++)
      await w.owner.mutation(internal.qualityFiles.reserveR2, args);
    await expect(
      w.owner.mutation(internal.qualityFiles.reserveR2, args),
    ).rejects.toThrow("FILE_LIMIT");
  });
  it("finalization is idempotent and cleanup cannot claim an attached upload", async () => {
    const w = await world();
    mockR2();
    const id = await w.owner.action(api.qualityFiles.upload, w.uploadArgs);
    const row = await w.t.run((ctx) => ctx.db.query("qualityUploads").first());
    if (!row) throw new Error("fixture");
    const metadata = {
      inspectionId: w.inspectionId,
      shareWithBuyer: true,
      kind: "coa" as const,
      name: "quality.pdf",
      contentType: "application/pdf",
    };
    expect(
      await w.owner.mutation(internal.qualityFiles.recordUpload, {
        ...metadata,
        uploadId: row._id,
        size: row.size,
        sha256: row.sha256,
      }),
    ).toBe(id);
    await w.t.run((ctx) =>
      ctx.db.patch("qualityUploads", row._id, { cleanupAt: 0 }),
    );
    expect(await w.t.mutation(internal.qualityFiles.claimCleanup, {})).toEqual(
      [],
    );
  });
  it("expired uploads cannot be attached after cleanup claims them", async () => {
    const w = await world();
    const provider = mockR2();
    provider.fetcher.mockRejectedValueOnce(new Error("offline"));
    await expect(
      w.owner.action(api.qualityFiles.upload, w.uploadArgs),
    ).rejects.toThrow();
    const row = await w.t.run((ctx) => ctx.db.query("qualityUploads").first());
    if (!row) throw new Error("fixture");
    await w.t.run((ctx) =>
      ctx.db.patch("qualityUploads", row._id, { cleanupAt: 0 }),
    );
    expect(
      await w.t.mutation(internal.qualityFiles.claimCleanup, {}),
    ).toHaveLength(1);
    const metadata = {
      inspectionId: w.inspectionId,
      shareWithBuyer: true,
      kind: "coa" as const,
      name: "quality.pdf",
      contentType: "application/pdf",
    };
    await expect(
      w.owner.mutation(internal.qualityFiles.recordUpload, {
        ...metadata,
        uploadId: row._id,
        size: row.size,
        sha256: row.sha256,
      }),
    ).rejects.toThrow("INVALID_UPLOAD");
  });
});
