// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import contract from "../docs/api/surepass-validation.schema.json";
import { api, internal } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import { gstBusiness, identityInputs } from "./lib/identityChecks";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const gstin = "29ABCDE1234F1Z5";
const details = {
  gstin,
  businessName: "Registered Test Shop",
  legalName: "Test Business",
  address: "12 Test Street, Bengaluru",
};
const shop = {
  ownerName: "Test Owner",
  shopName: details.businessName,
  gstRegistered: true,
  gstin,
  address: details.address,
  offersPickup: false,
  phones: [],
  opens: "08:00",
  closes: "20:00",
  weeklyOff: [],
};
const payload = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  status_code: 200,
  data: {
    gstin,
    gstin_status: "Active",
    business_name: details.businessName,
    legal_name: details.legalName,
    address: details.address,
    ...overrides,
  },
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function setup() {
  vi.stubEnv("SUREPASS_ENABLED", "true");
  vi.stubEnv("SUREPASS_API_TOKEN", "test-token");
  const t = convexTest(schema, modules);
  registerAuth(t);
  const as = await signIn(t, {
    email: "test@phone.luma.green",
    phoneNumber: "+919000000001",
  });
  await as.mutation(api.identity.ensureProfile, { locale: "en" });
  const applicationId = await as.mutation(api.applications.start, {
    kind: "kabadiwala",
    locale: "en",
    ageConfirmed: true,
    privacyAccepted: true,
  });
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: shop,
  });
  return { t, as, applicationId };
}
const mockSuccess = () => {
  const f = vi.fn().mockResolvedValue(Response.json(payload()));
  vi.stubGlobal("fetch", f);
  return f;
};
it("reserves at most 20 concurrent GST calls per verified account across applications", async () => {
  const { t, as, applicationId } = await setup();
  const ids = await t.run(async (ctx) => {
    const original = await ctx.db.get("applications", applicationId);
    if (!original) throw new Error("Missing fixture");
    const { _id, _creationTime, ...data } = original;
    return Promise.all(
      Array.from({ length: 22 }, () => ctx.db.insert("applications", data)),
    );
  });
  const results = await Promise.allSettled(
    ids.map((id) =>
      as.mutation(internal.identityChecks.reserve, {
        applicationId: id,
        kind: "gst",
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(20);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(2);
  expect(
    await t.run((ctx) => ctx.db.query("identityCheckDays").unique()),
  ).toMatchObject({ used: 20 });
});
it("returns the strict documented lookup response, caches it and requires explicit confirmation", async () => {
  const { t, as, applicationId } = await setup();
  const fetcher = mockSuccess();
  const result = await as.action(api.identityChecks.lookupGst, {
    applicationId,
    consent: true,
  });
  expect(result).toEqual(details);
  expect(Object.keys(result).toSorted((a, b) => a.localeCompare(b))).toEqual(
    [...contract.$defs.lookupGstResult.required].toSorted((a, b) =>
      a.localeCompare(b),
    ),
  );
  expect(fetcher).toHaveBeenCalledWith(
    "https://kyc-api.surepass.app/api/v1/corporate/gstin",
    expect.objectContaining({ body: JSON.stringify({ id_number: gstin }) }),
  );
  expect(await as.query(api.identityChecks.gst, { applicationId })).toEqual({
    ...details,
    confirmed: false,
  });
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.action(api.identityChecks.lookupGst, {
    applicationId,
    consent: true,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await as.mutation(api.identityChecks.confirmGst, { applicationId, gstin });
  expect(await as.query(api.identityChecks.gst, { applicationId })).toEqual({
    ...details,
    confirmed: true,
  });
  await as.mutation(api.applications.submit, { applicationId });
  const app = await t.run((ctx) => ctx.db.get("applications", applicationId));
  expect(app?.status).toBe("approved");
  expect(await t.run((ctx) => ctx.db.query("orgs").unique())).toMatchObject({
    name: details.businessName,
    status: "active",
    applicationId,
  });
  expect(
    await t.run((ctx) => ctx.db.query("memberships").unique()),
  ).toMatchObject({ role: "owner" });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "applications").eq("entityId", applicationId),
        )
        .take(20),
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "application.approved",
        metadata: expect.objectContaining({ automatic: true }),
      }),
    ]),
  );
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("NOT_EDITABLE");
});
it("does not collect, validate or spend on a legacy optional PAN", async () => {
  const { t, as, applicationId } = await setup();
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { ...shop, gstRegistered: false, pan: "wrong" },
  });
  const app = await t.run((ctx) => ctx.db.get("applications", applicationId));
  expect(app?.kabadiwala?.pan).toBeUndefined();
  expect(identityInputs({ pan: "invalid" })).toEqual([]);
  expect(
    identityInputs({ pan: "mismatch", gstRegistered: true, gstin }),
  ).toEqual([{ kind: "gst", input: gstin }]);
  expect(
    await as.mutation(internal.identityChecks.reserve, {
      applicationId,
      kind: "pan",
    }),
  ).toBeNull();
  await as.action(api.identityChecks.verify, { applicationId, consent: true });
  expect(
    await t.run((ctx) => ctx.db.query("identityCheckDays").unique()),
  ).toBeNull();
});
it("rejects unverified, inactive, mismatched or malformed provider metadata", () => {
  expect(gstBusiness(payload(), gstin)).toEqual(details);
  expect(gstBusiness(payload({ gstin_status: "Inactive" }), gstin)).toBeNull();
  expect(gstBusiness(payload({ gstin: "08ABCDE1234F1Z5" }), gstin)).toBeNull();
  expect(
    gstBusiness(payload({ business_name: "", legal_name: "" }), gstin),
  ).toBeNull();
  expect(
    gstBusiness(
      { success: false, status_code: 200, data: payload().data },
      gstin,
    ),
  ).toBeNull();
});
it("never retries failures and counts timeout, forbidden and invalid responses", async () => {
  for (const status of [0, 403, 422]) {
    const { t, as, applicationId } = await setup();
    const fetcher = status
      ? vi.fn().mockResolvedValue(Response.json({ success: false }, { status }))
      : vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      as.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
    ).rejects.toThrow(
      status === 422 ? "VALIDATION_REQUIRED" : "CHECK_UNAVAILABLE",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      await t.run((ctx) => ctx.db.query("identityCheckDays").unique()),
    ).toMatchObject({ used: 1 });
  }
});
it("blocks duplicates, other owners and old GST-by-PAN proofs", async () => {
  const { t, as, applicationId } = await setup();
  await t.run((ctx) =>
    ctx.db.insert("identityChecks", {
      applicationId,
      kind: "gst",
      input: gstin,
      status: "verified",
      createdAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
    }),
  );
  await expect(
    as.mutation(api.identityChecks.confirmGst, { applicationId, gstin }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  const first = await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "gst",
  });
  expect(first?.details).toBeUndefined();
  await expect(
    as.mutation(internal.identityChecks.reserve, {
      applicationId,
      kind: "gst",
    }),
  ).rejects.toThrow("CHECK_PENDING");
  const other = await signIn(t, {
    email: "other@phone.luma.green",
    phoneNumber: "+919000000002",
  });
  await other.mutation(api.identity.ensureProfile, { locale: "en" });
  await expect(
    other.query(api.identityChecks.gst, { applicationId }),
  ).rejects.toThrow("NO_APPLICATION");
  await expect(
    other.mutation(api.identityChecks.confirmGst, { applicationId, gstin }),
  ).rejects.toThrow("NO_APPLICATION");
});
it("invalidates confirmation after GSTIN changes, proof expiry or business name tampering", async () => {
  const { t, as, applicationId } = await setup();
  mockSuccess();
  await as.action(api.identityChecks.lookupGst, {
    applicationId,
    consent: true,
  });
  await as.mutation(api.identityChecks.confirmGst, { applicationId, gstin });
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { ...shop, gstin: "08ABCDE1234F1Z5" },
  });
  expect(await as.query(api.identityChecks.gst, { applicationId })).toBeNull();
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { ...shop, shopName: "Tampered name" },
  });
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: shop,
  });
  await t.run(async (ctx) => {
    const proof = await ctx.db.query("identityChecks").unique();
    if (!proof) throw new Error("Missing proof");
    await ctx.db.patch("identityChecks", proof._id, {
      expiresAt: Date.now() - 1,
    });
  });
  await expect(
    as.mutation(api.identityChecks.confirmGst, { applicationId, gstin }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
});
it("disabled and unauthenticated checks spend nothing", async () => {
  const { t, as, applicationId } = await setup();
  vi.stubEnv("SUREPASS_ENABLED", "false");
  await expect(
    as.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
  ).rejects.toThrow("CHECK_UNAVAILABLE");
  await expect(
    t.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
  ).rejects.toThrow("NOT_SIGNED_IN");
  const emailOnly = await signIn(t, { email: "email-only@example.test" });
  await expect(
    emailOnly.action(api.identityChecks.lookupGst, {
      applicationId,
      consent: true,
    }),
  ).rejects.toThrow("PHONE_REQUIRED");
  expect(
    await t.run((ctx) => ctx.db.query("identityCheckDays").unique()),
  ).toBeNull();
});
it("gives another verified account its own20-call allowance", async () => {
  const { t, as, applicationId } = await setup();
  const app = await t.run((ctx) => ctx.db.get("applications", applicationId));
  if (!app) throw new Error("Missing fixture");
  await t.run((ctx) =>
    ctx.db.insert("identityPersonCheckDays", {
      profileId: app.profileId,
      day: new Date(Date.now() + 19_800_000).toISOString().slice(0, 10),
      used: 20,
    }),
  );
  await expect(
    as.mutation(internal.identityChecks.reserve, {
      applicationId,
      kind: "gst",
    }),
  ).rejects.toThrow("CHECK_LIMIT");
  const other = await signIn(t, {
    email: "second@phone.luma.green",
    phoneNumber: "+919000000003",
  });
  await other.mutation(api.identity.ensureProfile, { locale: "en" });
  const id = await other.mutation(api.applications.start, {
    kind: "kabadiwala",
    locale: "en",
    ageConfirmed: true,
    privacyAccepted: true,
  });
  await other.mutation(api.applications.saveDraft, {
    applicationId: id,
    kabadiwala: shop,
  });
  expect(
    await other.mutation(internal.identityChecks.reserve, {
      applicationId: id,
      kind: "gst",
    }),
  ).not.toBeNull();
});
it("starts a new allowance at India midnight without resetting old usage", async () => {
  const { t, as, applicationId } = await setup();
  const now = new Date("2026-10-24T18:29:59Z").getTime();
  vi.spyOn(Date, "now").mockReturnValue(now);
  const reserved = await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "gst",
  });
  if (!reserved) throw new Error("Missing reservation");
  await t.mutation(internal.identityChecks.finish, {
    ...reserved,
    details: null,
  });
  vi.spyOn(Date, "now").mockReturnValue(now + 62_000);
  await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "gst",
  });
  const days = await t.run((ctx) => ctx.db.query("identityCheckDays").take(3));
  expect(days.map((row) => [row.day, row.used])).toEqual([
    ["2026-10-24", 1],
    ["2026-10-25", 1],
  ]);
});

it("operator examples share the cap, require the temporary switch and run once per kind", async () => {
  const { t } = await setup();
  vi.stubEnv("SUREPASS_EXAMPLE_TEST_ENABLED", "false");
  await expect(
    t.mutation(internal.identityExample.reserve, { kind: "pan" }),
  ).rejects.toThrow("CHECK_UNAVAILABLE");
  vi.stubEnv("SUREPASS_EXAMPLE_TEST_ENABLED", "true");
  await t.mutation(internal.identityExample.reserve, { kind: "pan" });
  await expect(
    t.mutation(internal.identityExample.reserve, { kind: "pan" }),
  ).rejects.toThrow("CHECK_LIMIT");
  await t.mutation(internal.identityExample.reserve, { kind: "gst" });
  const row = await t.run((ctx) => ctx.db.query("identityCheckDays").unique());
  expect(row?.used).toBe(2);
  if (!row) throw new Error("missing quota");
  await t.run((ctx) =>
    ctx.db.patch("identityCheckDays", row._id, {
      used: 20,
      operatorUsed: 20,
      examplePan: false,
    }),
  );
  await expect(
    t.mutation(internal.identityExample.reserve, { kind: "pan" }),
  ).rejects.toThrow("CHECK_LIMIT");
});

it("keeps confirmation idempotent and rejects a completion from another attempt", async () => {
  const { t, as, applicationId } = await setup();
  const reserved = await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "gst",
  });
  if (!reserved) throw new Error("Missing reservation");
  await expect(
    t.mutation(internal.identityChecks.finish, {
      id: reserved.id,
      input: reserved.input,
      createdAt: reserved.createdAt - 1,
      details,
    }),
  ).rejects.toThrow("CHECK_PENDING");
  await t.mutation(internal.identityChecks.finish, { ...reserved, details });
  await as.mutation(api.identityChecks.confirmGst, { applicationId, gstin });
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { ...shop, address: "Operating site at another address" },
  });
  await as.mutation(api.identityChecks.confirmGst, { applicationId, gstin });
  const app = await t.run((ctx) => ctx.db.get("applications", applicationId));
  expect(app?.kabadiwala?.address).toBe("Operating site at another address");
  const rows = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "applications").eq("entityId", applicationId),
      )
      .take(20),
  );
  expect(
    rows.filter((row) => row.action === "identity.business_confirmed"),
  ).toHaveLength(1);
});
it("rejects malformed GSTIN before a paid reservation", async () => {
  const { t, as, applicationId } = await setup();
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { ...shop, gstin: "invalid" },
  });
  await expect(
    as.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  expect(
    await t.run((ctx) => ctx.db.query("identityCheckDays").unique()),
  ).toBeNull();
});
