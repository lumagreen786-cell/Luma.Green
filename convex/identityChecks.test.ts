// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import { identityInputs, providerVerified } from "./lib/identityChecks";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const pan = "ABCDE1234F";
const gst = `29${pan}1Z5`;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
    kabadiwala: { pan, gstRegistered: true, gstin: gst },
  });
  return { t, as, applicationId };
}
it("shares exactly 20 attempts per account across PAN/GST and stops concurrent overflow", async () => {
  const { t, as, applicationId } = await setup();
  // Distinct applications model independent applicants while retaining real auth.
  const ids = await t.run(async (ctx) => {
    const original = await ctx.db.get("applications", applicationId);
    if (!original) throw new Error("missing fixture");
    const { _id, _creationTime, ...data } = original;
    return Promise.all(
      Array.from({ length: 22 }, () => ctx.db.insert("applications", data)),
    );
  });
  const results = await Promise.allSettled(
    ids.map((id, i) =>
      as.mutation(internal.identityChecks.reserve, {
        applicationId: id,
        kind: i % 2 ? "gst" : "pan",
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(20);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(2);
  const used = await t.run((ctx) => ctx.db.query("identityCheckDays").unique());
  expect(used?.used).toBe(20);
});
it("deduplicates in-flight and verified calls, rejects another owner", async () => {
  const { t, as, applicationId } = await setup();
  const args = { applicationId, kind: "pan" as const };
  const first = await as.mutation(internal.identityChecks.reserve, args);
  expect(first).not.toBeNull();
  await expect(
    as.mutation(internal.identityChecks.reserve, args),
  ).rejects.toThrow("CHECK_PENDING");
  if (!first) throw new Error("missing reservation");
  await t.mutation(internal.identityChecks.finish, {
    ...first,
    verified: true,
  });
  expect(await as.mutation(internal.identityChecks.reserve, args)).toBeNull();
  const other = await signIn(t, {
    email: "other@phone.luma.green",
    phoneNumber: "+919000000002",
  });
  await other.mutation(api.identity.ensureProfile, { locale: "en" });
  await expect(
    other.mutation(internal.identityChecks.reserve, args),
  ).rejects.toThrow("NO_APPLICATION");
  const quota = await t.run((ctx) =>
    ctx.db.query("identityCheckDays").unique(),
  );
  expect(quota?.used).toBe(1);
});
it("makes no retry after provider failure and counts the attempt", async () => {
  const { t, as, applicationId } = await setup();
  const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    as.action(api.identityChecks.verify, { applicationId, consent: true }),
  ).rejects.toThrow("CHECK_UNAVAILABLE");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const quota = await t.run((ctx) =>
    ctx.db.query("identityCheckDays").unique(),
  );
  expect(quota?.used).toBe(1);
});
it("allows absent PAN, derives GST PAN, and rejects mismatches before spending", () => {
  expect(identityInputs()).toEqual([]);
  expect(identityInputs({ gstRegistered: true, gstin: gst })).toEqual([
    { kind: "gst", input: gst },
  ]);
  expect(() =>
    identityInputs({ pan: "WRONG1234X", gstRegistered: true, gstin: gst }),
  ).toThrow("VALIDATION_REQUIRED");
});
it("requires exact provider identity and active consistent GST rows", () => {
  const result = (rows: unknown[]) => ({
    success: true,
    status_code: 200,
    data: { pan_number: pan, gstin_list: rows },
  });
  expect(
    providerVerified(
      result([{ gstin: gst, active_status: "Active" }]),
      "gst",
      gst,
    ),
  ).toBe(true);
  expect(
    providerVerified(
      result([
        { gstin: gst, active_status: "Active" },
        { gstin: gst, active_status: "Inactive" },
      ]),
      "gst",
      gst,
    ),
  ).toBe(false);
  expect(providerVerified(result([]), "gst", gst)).toBe(false);
  expect(
    providerVerified(
      { success: true, status_code: 200, data: { pan_number: "XXXXX0000X" } },
      "pan",
      pan,
    ),
  ).toBe(false);
  expect(providerVerified({ success: false }, "pan", pan)).toBe(false);
});

it("starts a new allowance at India midnight without resetting earlier attempts", async () => {
  const { t, as, applicationId } = await setup();
  const now = new Date("2026-10-24T18:29:59.000Z").getTime();
  vi.spyOn(Date, "now").mockReturnValue(now);
  await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "pan",
  });
  vi.spyOn(Date, "now").mockReturnValue(now + 2000);
  await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "gst",
  });
  const days = await t.run((ctx) => ctx.db.query("identityCheckDays").take(3));
  expect(days.map((d) => [d.day, d.used])).toEqual([
    ["2026-10-24", 1],
    ["2026-10-25", 1],
  ]);
  vi.restoreAllMocks();
});
it("disabled and unauthenticated checks spend nothing", async () => {
  const { t, as, applicationId } = await setup();
  vi.stubEnv("SUREPASS_ENABLED", "false");
  await expect(
    as.action(api.identityChecks.verify, { applicationId, consent: true }),
  ).rejects.toThrow("CHECK_UNAVAILABLE");
  await expect(
    t.action(api.identityChecks.verify, { applicationId, consent: true }),
  ).rejects.toThrow("NOT_SIGNED_IN");
  expect(
    await t.run((ctx) => ctx.db.query("identityCheckDays").unique()),
  ).toBeNull();
});
it("submission cannot bypass proof or reuse a check after editing PAN", async () => {
  const { t, as, applicationId } = await setup();
  const shop = {
    ownerName: "Test Owner",
    shopName: "Test Shop",
    pan,
    gstRegistered: false,
    address: "12 Test Street",
    offersPickup: false,
    phones: [],
    opens: "08:00",
    closes: "20:00",
    weeklyOff: [],
  };
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: shop,
  });
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  const proof = await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "pan",
  });
  if (!proof) throw new Error("missing fixture");
  await t.mutation(internal.identityChecks.finish, {
    ...proof,
    verified: true,
  });
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { ...shop, pan: "BCDEF1234G" },
  });
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: shop,
  });
  await as.mutation(api.applications.submit, { applicationId });
});
it("reuses successful proofs without a second paid request", async () => {
  const { t, as, applicationId } = await setup();
  const fetcher = vi
    .fn()
    .mockImplementation((_url: string, init: RequestInit) => {
      if (typeof init.body !== "string") throw new Error("Expected JSON body");
      const request = JSON.parse(init.body) as {
        id_number: string;
        masked_aadhaar_variant?: string;
      };
      expect(request.id_number).toBe(pan);
      return Promise.resolve(
        Response.json(
          {
            success: true,
            status_code: 200,
            data: {
              pan_number: pan,
              gstin_list: [{ gstin: gst, active_status: "Active" }],
            },
          },
          { status: 200 },
        ),
      );
    });
  vi.stubGlobal("fetch", fetcher);
  expect(
    await as.action(api.identityChecks.verify, {
      applicationId,
      consent: true,
    }),
  ).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(
    await as.action(api.identityChecks.verify, {
      applicationId,
      consent: true,
    }),
  ).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
  const quota = await t.run((ctx) =>
    ctx.db.query("identityCheckDays").unique(),
  );
  expect(quota?.used).toBe(2);
});
it("requires phone verification before spending and rejects expired proof", async () => {
  const { t, as, applicationId } = await setup();
  const emailOnly = await signIn(t, { email: "email-only@example.test" });
  await expect(
    emailOnly.action(api.identityChecks.verify, {
      applicationId,
      consent: true,
    }),
  ).rejects.toThrow("PHONE_REQUIRED");
  expect(
    await t.run((ctx) => ctx.db.query("identityCheckDays").unique()),
  ).toBeNull();
  const proof = await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "pan",
  });
  if (!proof) throw new Error("missing proof");
  await t.mutation(internal.identityChecks.finish, {
    ...proof,
    verified: true,
  });
  await t.run((ctx) =>
    ctx.db.patch("identityChecks", proof.id, { expiresAt: Date.now() - 1 }),
  );
  const renewed = await as.mutation(internal.identityChecks.reserve, {
    applicationId,
    kind: "pan",
  });
  expect(renewed).not.toBeNull();
  const quota = await t.run((ctx) =>
    ctx.db.query("identityCheckDays").unique(),
  );
  expect(quota?.used).toBe(2);
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
it("gives another verified account its own allowance after the first account uses 20", async () => {
  const { t, as, applicationId } = await setup();
  const firstProfile = await t.run((ctx) =>
    ctx.db.get("applications", applicationId),
  );
  if (!firstProfile) throw new Error("missing profile");
  await t.run((ctx) =>
    ctx.db.insert("identityPersonCheckDays", {
      profileId: firstProfile.profileId,
      day: new Date(Date.now() + 19_800_000).toISOString().slice(0, 10),
      used: 20,
    }),
  );
  await expect(
    as.mutation(internal.identityChecks.reserve, {
      applicationId,
      kind: "pan",
    }),
  ).rejects.toThrow("CHECK_LIMIT");
  const other = await signIn(t, {
    email: "second@phone.luma.green",
    phoneNumber: "+919000000003",
  });
  await other.mutation(api.identity.ensureProfile, { locale: "en" });
  const second = await other.mutation(api.applications.start, {
    kind: "kabadiwala",
    locale: "en",
    ageConfirmed: true,
    privacyAccepted: true,
  });
  await other.mutation(api.applications.saveDraft, {
    applicationId: second,
    kabadiwala: { pan },
  });
  expect(
    await other.mutation(internal.identityChecks.reserve, {
      applicationId: second,
      kind: "pan",
    }),
  ).not.toBeNull();
});
it("asks the applicant to correct identifiers rejected with 422 without retrying", async () => {
  const { t, as, applicationId } = await setup();
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ success: false, status_code: 422 }, { status: 422 }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    as.action(api.identityChecks.verify, { applicationId, consent: true }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const quota = await t.run((ctx) =>
    ctx.db.query("identityCheckDays").unique(),
  );
  expect(quota?.used).toBe(1);
});
