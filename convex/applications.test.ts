/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));

function setup() {
  const t = convexTest(schema, modules);
  registerAuth(t);
  return t;
}

type Test = ReturnType<typeof setup>;

/** A phone user who has signed in once (so their profile exists). */
async function applicant(t: Test, phone = "+919000000001") {
  const as = await signIn(t, {
    email: `${phone.slice(1)}@phone.luma.green`,
    phoneNumber: phone,
  });
  await as.mutation(api.identity.ensureProfile, { locale: "kn" });
  return as;
}

const consent = {
  locale: "kn",
  ageConfirmed: true,
  privacyAccepted: true,
} as const;

const shop = {
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
};

const ascii = (text: string) => [...new TextEncoder().encode(text)];

/** Just enough of each format for the byte check to recognise it. */
const SIGNATURES = {
  pdf: ascii("%PDF-1.7\n"),
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10],
  mp4: [0x00, 0x00, 0x00, 0x18, ...ascii("ftypisom")],
  text: ascii("just some notes"),
};

async function upload(t: Test, format: keyof typeof SIGNATURES) {
  const bytes = new Uint8Array(SIGNATURES[format].length + 1024);
  bytes.set(SIGNATURES[format]);
  return t.run(async (ctx) => ctx.storage.store(new Blob([bytes])));
}

async function attach(
  as: Awaited<ReturnType<typeof applicant>>,
  storageId: Id<"_storage">,
  type: "pcb_certificate" | "machine_media" | "id_proof" | "selfie",
  name: string,
) {
  const result = await as.action(api.applicationFiles.attach, {
    storageId,
    type,
    name,
  });
  if (!result.ok) throw new Error(result.error);
  return result.fileId;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("signed out", () => {
  it("sees no application and can't start one", async () => {
    const t = setup();
    expect(await t.query(api.applications.mine, {})).toBeNull();
    await expect(
      t.mutation(api.applications.start, { kind: "kabadiwala", ...consent }),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
    await expect(
      t.mutation(api.applicationFiles.generateUploadUrl, {}),
    ).rejects.toThrow(/NOT_SIGNED_IN/);
  });
});

describe("a kabadiwala's application", () => {
  it("does not write unchanged drafts, including empty saves and reordered keys", async () => {
    const t = setup();
    const ramesh = await applicant(t);
    const id = await ramesh.mutation(api.applications.start, {
      kind: "kabadiwala",
      ...consent,
    });
    const initial = await t.run((ctx) => ctx.db.get("applications", id));
    vi.spyOn(Date, "now").mockReturnValue(initial!.updatedAt + 1000);
    await ramesh.mutation(api.applications.saveDraft, {});
    expect(await t.run((ctx) => ctx.db.get("applications", id))).toEqual(
      initial,
    );

    await ramesh.mutation(api.applications.saveDraft, { kabadiwala: shop });
    const saved = await t.run((ctx) => ctx.db.get("applications", id));
    expect(saved!.updatedAt).toBe(initial!.updatedAt + 1000);
    vi.spyOn(Date, "now").mockReturnValue(initial!.updatedAt + 2000);
    const { shopName, ...otherFields } = shop;
    await ramesh.mutation(api.applications.saveDraft, {
      kabadiwala: { shopName, ...otherFields },
    });
    expect(await t.run((ctx) => ctx.db.get("applications", id))).toEqual(saved);

    await ramesh.mutation(api.applications.saveDraft, {
      kabadiwala: { ...shop, shopName: "New shop name" },
    });
    expect(await t.run((ctx) => ctx.db.get("applications", id))).toMatchObject({
      updatedAt: initial!.updatedAt + 2000,
      kabadiwala: { shopName: "New shop name", ownerName: shop.ownerName },
    });
  });

  it("activates a complete application and keeps a snapshot without manual review", async () => {
    const t = setup();
    const ramesh = await applicant(t);

    const id = await ramesh.mutation(api.applications.start, {
      kind: "kabadiwala",
      ...consent,
    });
    // Starting again as the same role is the same application.
    expect(
      await ramesh.mutation(api.applications.start, {
        kind: "kabadiwala",
        ...consent,
      }),
    ).toBe(id);

    await expect(ramesh.mutation(api.applications.submit, {})).rejects.toThrow(
      /INCOMPLETE/,
    );

    await ramesh.mutation(api.applications.saveDraft, { kabadiwala: shop });
    await ramesh.mutation(api.applications.submit, {});

    const mine = await ramesh.query(api.applications.mine, {});
    expect(mine).toMatchObject({
      loginPhone: "+919000000001",
      application: { id, status: "approved", version: 1, kabadiwala: shop },
    });

    const trail = await t.run(async (ctx) => ({
      snapshots: await ctx.db.query("applicationSnapshots").collect(),
      audit: await ctx.db.query("auditLog").collect(),
    }));
    expect(trail.snapshots).toHaveLength(1);
    expect(trail.snapshots[0]).toMatchObject({ version: 1, kabadiwala: shop });
    expect(trail.audit.map((row) => row.action)).toEqual([
      "profile.created",
      "application.started",
      "org.created",
      "application.submitted",
      "application.approved",
      "inbox.created",
      "notification.disabled",
    ]);
    const inbox = await ramesh.query(api.inbox.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(inbox.page).toHaveLength(1);
    expect(inbox.page[0]).toMatchObject({
      event: "application_approved",
      read: false,
    });
    expect(
      trail.audit.find((row) => row.action === "inbox.created"),
    ).toMatchObject({
      entityTable: "inbox",
      entityId: inbox.page[0]?.id,
    });
  });

  it("locks the activated application against duplicate submission", async () => {
    const t = setup();
    const ramesh = await applicant(t);
    await ramesh.mutation(api.applications.start, {
      kind: "kabadiwala",
      ...consent,
    });
    await ramesh.mutation(api.applications.saveDraft, { kabadiwala: shop });
    await ramesh.mutation(api.applications.submit, {});

    await expect(
      ramesh.mutation(api.applications.saveDraft, { kabadiwala: shop }),
    ).rejects.toThrow(/NOT_EDITABLE/);
    await expect(ramesh.mutation(api.applications.submit, {})).rejects.toThrow(
      /NOT_EDITABLE/,
    );
  });

  it("only takes the sections for its role", async () => {
    const t = setup();
    const ramesh = await applicant(t);
    await ramesh.mutation(api.applications.start, {
      kind: "kabadiwala",
      ...consent,
    });
    await expect(
      ramesh.mutation(api.applications.saveDraft, { saathi: { name: "X" } }),
    ).rejects.toThrow(/WRONG_SECTION/);
  });

  it("can be thrown away before it's sent, to start as another role", async () => {
    const t = setup();
    const ramesh = await applicant(t);
    await ramesh.mutation(api.applications.start, {
      kind: "kabadiwala",
      ...consent,
    });
    await expect(
      ramesh.mutation(api.applications.start, { kind: "saathi", ...consent }),
    ).rejects.toThrow(/ALREADY_APPLYING/);

    await ramesh.mutation(api.applications.discard, {});
    await ramesh.mutation(api.applications.start, {
      kind: "saathi",
      ...consent,
    });
    expect(await ramesh.query(api.applications.mine, {})).toMatchObject({
      application: { kind: "saathi", status: "draft" },
    });
  });
});

describe("privacy between applicants", () => {
  it("never shows one person's application to another", async () => {
    const t = setup();
    const ramesh = await applicant(t, "+919000000001");
    const suresh = await applicant(t, "+919000000002");
    await ramesh.mutation(api.applications.start, {
      kind: "kabadiwala",
      ...consent,
    });
    await ramesh.mutation(api.applications.saveDraft, { kabadiwala: shop });

    expect(await suresh.query(api.applications.mine, {})).toEqual({
      loginPhone: "+919000000002",
      application: null,
    });
    // And nothing Suresh does touches Ramesh's draft.
    await expect(
      suresh.mutation(api.applications.saveDraft, { kabadiwala: shop }),
    ).rejects.toThrow(/NO_APPLICATION/);
  });

  it("can't attach or remove someone else's file", async () => {
    const t = setup();
    const yard = await applicant(t, "+919000000001");
    const other = await applicant(t, "+919000000002");
    await yard.mutation(api.applications.start, { kind: "yard", ...consent });
    await other.mutation(api.applications.start, { kind: "yard", ...consent });

    const storageId = await upload(t, "pdf");
    const fileId = await attach(
      yard,
      storageId,
      "pcb_certificate",
      "consent.pdf",
    );
    await expect(
      other.mutation(api.applicationFiles.remove, { fileId }),
    ).rejects.toThrow(/FILE_NOT_FOUND/);
    // Nor claim (or, on a failed check, delete) an upload that's already in use.
    await expect(
      attach(other, storageId, "pcb_certificate", "mine-now.pdf"),
    ).rejects.toThrow(/FILE_IN_USE/);
    expect(
      await t.run(async (ctx) => ctx.db.system.get("_storage", storageId)),
    ).not.toBeNull();
  });
});

describe("the admin", () => {
  it("doesn't apply", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
    const t = setup();
    const admin = await signIn(t, {
      email: "admin@luma.test",
      twoFactorEnabled: true,
    });
    await admin.mutation(api.identity.ensureProfile, { locale: "en" });
    await expect(
      admin.mutation(api.applications.start, { kind: "yard", ...consent }),
    ).rejects.toThrow(/NOT_A_MEMBER/);
  });
});

describe("uploads", () => {
  it("checks the real type from the bytes, deleting what fails", async () => {
    const t = setup();
    const yard = await applicant(t);
    await yard.mutation(api.applications.start, { kind: "yard", ...consent });

    const notes = await upload(t, "text");
    expect(
      await yard.action(api.applicationFiles.attach, {
        storageId: notes,
        type: "machine_media",
        name: "shredder.jpg", // the name says photo; the bytes say otherwise
      }),
    ).toEqual({ ok: false, error: "fileType" });
    expect(
      await t.run(async (ctx) => ctx.db.system.get("_storage", notes)),
    ).toBeNull();

    // A PDF is fine as a certificate, not as a machine photo.
    expect(
      await yard.action(api.applicationFiles.attach, {
        storageId: await upload(t, "pdf"),
        type: "machine_media",
        name: "photo.pdf",
      }),
    ).toEqual({ ok: false, error: "fileType" });

    // A yard has no Saathi uploads.
    await expect(
      attach(yard, await upload(t, "jpeg"), "selfie", "me.jpg"),
    ).rejects.toThrow(/WRONG_FILE_TYPE/);
  });

  it("replaces a single-file slot instead of piling up", async () => {
    const t = setup();
    const lakshmi = await applicant(t);
    await lakshmi.mutation(api.applications.start, {
      kind: "saathi",
      ...consent,
    });
    for (const name of ["first.jpg", "second.jpg"]) {
      await attach(lakshmi, await upload(t, "jpeg"), "selfie", name);
    }
    const mine = await lakshmi.query(api.applications.mine, {});
    expect(mine?.application?.files.map((file) => file.name)).toEqual([
      "second.jpg",
    ]);
    expect(mine?.application?.files[0]?.contentType).toBe("image/jpeg");
  });

  it("lets a complete business submit, and keeps sent files for the record", async () => {
    const t = setup();
    const yard = await applicant(t);
    const applicationId = await yard.mutation(api.applications.start, {
      kind: "recycler",
      ...consent,
    });
    await yard.mutation(api.applications.saveDraft, {
      business: {
        city: "Bengaluru",
        businessName: "Peenya Plastics",
        gstRegistered: true,
        gstin: "29ABCDE1234F1Z5",
        materials: ["plastic"],
        address: "Plot 7, Peenya Industrial Area, Bengaluru",
        locationTags: [],
        collectsFromSuppliers: false,
        phones: [],
        opens: "09:00",
        closes: "18:00",
        weeklyOff: ["sun"],
      },
      documents: {
        pcbNotRequired: false,
        board: "kspcb",
        consentNumber: "KSPCB/CFO/2025/77",
        validUntil: "2099-12-31",
        declaration: true,
      },
    });
    const files: Id<"applicationFiles">[] = [
      await attach(
        yard,
        await upload(t, "pdf"),
        "pcb_certificate",
        "consent.pdf",
      ),
    ];
    await expect(yard.mutation(api.applications.submit, {})).rejects.toThrow(
      /INCOMPLETE/,
    );
    files.push(
      await attach(
        yard,
        await upload(t, "jpeg"),
        "machine_media",
        "shredder.jpg",
      ),
      await attach(yard, await upload(t, "mp4"), "machine_media", "line.mp4"),
    );
    await expect(yard.mutation(api.applications.submit, {})).rejects.toThrow(
      "VALIDATION_REQUIRED",
    );
    await t.run((ctx) =>
      ctx.db.insert("identityChecks", {
        applicationId,
        kind: "gst",
        input: "29ABCDE1234F1Z5",
        status: "verified",
        provider: "gstin",
        businessName: "Peenya Plastics",
        legalName: "Peenya Plastics",
        address: "Plot 7, Peenya Industrial Area, Bengaluru",
        confirmedAt: Date.now(),
        createdAt: Date.now(),
        expiresAt: Date.now() + 86_400_000,
      }),
    );
    await yard.mutation(api.applications.submit, {});

    const stored = await t.run(async (ctx) =>
      Promise.all(files.map(async (id) => ctx.db.get("applicationFiles", id))),
    );
    expect(stored.map((file) => file?.firstSubmittedVersion)).toEqual([
      1, 1, 1,
    ]);
  });
});

describe("attachment cleanup races", () => {
  it.each(["attach", "cleanup"] as const)(
    "does not let application %s claim or delete a household photo",
    async (operation) => {
      const t = setup();
      const yard = await applicant(t);
      await yard.mutation(api.applications.start, { kind: "yard", ...consent });
      const storageId = await upload(t, "jpeg");
      await t.run(async (ctx) => {
        const profile = await ctx.db.query("profiles").first();
        if (!profile) throw new Error("Missing profile fixture");
        await ctx.db.insert("householdPhotos", {
          profileId: profile._id,
          storageId,
          name: "private-household.jpg",
          contentType: "image/jpeg",
          size: SIGNATURES.jpeg.length + 1024,
          createdAt: Date.now(),
        });
      });
      if (operation === "attach")
        await expect(
          attach(yard, storageId, "machine_media", "claimed.jpg"),
        ).rejects.toThrow("FILE_IN_USE");
      else
        await yard.mutation(internal.applicationFiles.discardUnattached, {
          storageId,
        });
      expect(
        await t.run(async (ctx) => (await ctx.storage.get(storageId)) !== null),
      ).toBe(true);
    },
  );

  it("keeps a stored file when another request attached it before cleanup", async () => {
    const t = setup();
    const yard = await applicant(t);
    await yard.mutation(api.applications.start, { kind: "yard", ...consent });
    const storageId = await upload(t, "pdf");
    const request = { storageId, type: "pcb_certificate" as const };
    await yard.query(internal.applicationFiles.checkAttach, request);
    await yard.query(internal.applicationFiles.checkAttach, request);
    const saved = await yard.mutation(internal.applicationFiles.record, {
      ...request,
      name: "certificate.pdf",
      contentType: "application/pdf",
      size: SIGNATURES.pdf.length + 1024,
    });
    await expect(
      yard.mutation(internal.applicationFiles.record, {
        ...request,
        name: "duplicate.pdf",
        contentType: "application/pdf",
        size: SIGNATURES.pdf.length + 1024,
      }),
    ).rejects.toThrow(/FILE_IN_USE/);
    await yard.mutation(internal.applicationFiles.discardUnattached, {
      storageId,
    });
    expect(
      await t.run(async (ctx) => (await ctx.storage.get(storageId)) !== null),
    ).toBe(true);
    expect(
      await t.run((ctx) => ctx.db.get("applicationFiles", saved)),
    ).not.toBeNull();
  });

  it("does not attach a file that cleanup deleted after the first check", async () => {
    const t = setup();
    const yard = await applicant(t);
    await yard.mutation(api.applications.start, { kind: "yard", ...consent });
    const storageId = await upload(t, "pdf");
    const request = { storageId, type: "pcb_certificate" as const };
    await yard.query(internal.applicationFiles.checkAttach, request);
    await yard.mutation(internal.applicationFiles.discardUnattached, {
      storageId,
    });
    await expect(
      yard.mutation(internal.applicationFiles.record, {
        ...request,
        name: "certificate.pdf",
        contentType: "application/pdf",
        size: SIGNATURES.pdf.length + 1024,
      }),
    ).rejects.toThrow(/FILE_NOT_FOUND/);
    expect(
      await t.run((ctx) => ctx.db.query("applicationFiles").collect()),
    ).toEqual([]);
  });
});

it("activates Saathis after required ID and selfie uploads without PAN checks", async () => {
  const t = setup();
  const person = await applicant(t);
  const applicationId = await person.mutation(api.applications.start, {
    kind: "saathi",
    ...consent,
  });
  await person.mutation(api.applications.saveDraft, {
    saathi: {
      city: "Bengaluru",
      name: "Test Helper",
      area: "Bengaluru",
      radiusKm: 2,
      workTypes: ["home_pickups"],
      vehicle: "none",
      times: ["morning"],
      days: ["mon"],
      pan: "ABCDE1234F",
    },
  });
  await expect(person.mutation(api.applications.submit, {})).rejects.toThrow(
    "INCOMPLETE",
  );
  await attach(person, await upload(t, "pdf"), "id_proof", "identity.pdf");
  await attach(person, await upload(t, "jpeg"), "selfie", "selfie.jpg");
  await person.mutation(api.applications.submit, {});
  expect(
    await t.run((ctx) => ctx.db.get("applications", applicationId)),
  ).toMatchObject({ status: "approved" });
  expect(
    await t.run((ctx) => ctx.db.query("saathiProfiles").unique()),
  ).toMatchObject({ applicationId, status: "active" });
  expect(
    await t.run((ctx) => ctx.db.query("identityCheckDays").unique()),
  ).toBeNull();
});
