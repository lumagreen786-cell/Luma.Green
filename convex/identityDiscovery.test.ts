// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import { registrationsFrom } from "./lib/identityDiscovery";
import schema from "./schema";
const modules = convexModules(import.meta.glob("./**/*.*s"));
const pan = "ABCDE1234F";
const gstin = `29${pan}1Z5`;
const registration = {
  gstin,
  state: "Karnataka",
  stateCode: "29",
  status: "Active",
};
const payload = (
  list: unknown[] = [
    { gstin, state: "Karnataka", state_code: "29", active_status: "Active" },
  ],
) => ({
  success: true,
  status_code: 200,
  data: { pan_number: pan, gstin_list: list },
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
    email: "discover@phone.luma.green",
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
    kabadiwala: { gstRegistered: true, pan },
  });
  return { t, as, applicationId };
}
it.each(["kabadiwala", "yard", "recycler", "manufacturer"] as const)(
  "loads a new %s draft before any GST details are saved without a provider call",
  async (kind) => {
    const { t, as, applicationId } = await setup();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await t.run((ctx) =>
      ctx.db.patch("applications", applicationId, {
        kind,
        kabadiwala: undefined,
        business: undefined,
      }),
    );
    expect(
      await as.query(api.identityDiscovery.current, { applicationId }),
    ).toBeNull();
    await expect(
      as.action(api.identityDiscovery.lookup, { applicationId, consent: true }),
    ).rejects.toThrow("VALIDATION_REQUIRED");
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      await t.run((ctx) => ctx.db.query("identityPersonCheckDays").take(1)),
    ).toEqual([]);
  },
);
it("clears saved discovery when GST registration is removed without crashing the query", async () => {
  const { as, applicationId } = await setup();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload())));
  await as.action(api.identityDiscovery.lookup, {
    applicationId,
    consent: true,
  });
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { gstRegistered: false },
  });
  expect(
    await as.query(api.identityDiscovery.current, { applicationId }),
  ).toBeNull();
  await expect(
    as.mutation(api.identityDiscovery.select, { applicationId, gstin }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
});
it("rejects mismatched PAN and ambiguous duplicates and retains only bounded registration data", () => {
  expect(registrationsFrom(payload(), pan)).toEqual([registration]);
  expect(registrationsFrom(payload(), "AAAAA1111A")).toBeNull();
  expect(
    registrationsFrom(
      payload([
        { gstin, state: "x", state_code: "29", active_status: "Active" },
        { gstin, state: "y", state_code: "29", active_status: "Active" },
      ]),
      pan,
    ),
  ).toBeNull();
});
it("caches owned discovery, selects a registration, and preserves the separate detail gate", async () => {
  const { t, as, applicationId } = await setup();
  const fetcher = vi.fn().mockResolvedValue(Response.json(payload()));
  vi.stubGlobal("fetch", fetcher);
  expect(
    await as.action(api.identityDiscovery.lookup, {
      applicationId,
      consent: true,
    }),
  ).toEqual({ pan, registrations: [registration] });
  await as.action(api.identityDiscovery.lookup, {
    applicationId,
    consent: true,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await as.mutation(api.identityDiscovery.select, { applicationId, gstin });
  const selectedApplication = await t.run((ctx) =>
    ctx.db.get("applications", applicationId),
  );
  expect(selectedApplication?.kabadiwala?.gstin).toBe(gstin);
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow();
  await expect(
    t.query(api.identityDiscovery.current, { applicationId }),
  ).rejects.toThrow();
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { gstRegistered: true, pan: "AAAAA1111A" },
  });
  expect(
    await as.query(api.identityDiscovery.current, { applicationId }),
  ).toBeNull();
  await expect(
    as.mutation(api.identityDiscovery.select, { applicationId, gstin }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
});
it("blocks duplicate pending calls and stale completions after PAN changes", async () => {
  const { t, as, applicationId } = await setup();
  const reserved = await as.mutation(internal.identityDiscovery.reserve, {
    applicationId,
  });
  await expect(
    as.mutation(internal.identityDiscovery.reserve, { applicationId }),
  ).rejects.toThrow("CHECK_PENDING");
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { gstRegistered: true, pan: "AAAAA1111A" },
  });
  await as.mutation(internal.identityDiscovery.finish, {
    id: reserved.id,
    input: reserved.input,
    createdAt: reserved.createdAt,
    registrations: [registration],
  });
  expect(
    await as.query(api.identityDiscovery.current, { applicationId }),
  ).toBeNull();
  const audit = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "applications").eq("entityId", applicationId),
      )
      .take(20),
  );
  expect(
    audit.find((event) => event.action === "identity.discovery_finished")
      ?.metadata,
  ).toMatchObject({ verified: false });
});

it("requires selection and detail confirmation before a complete shop can activate", async () => {
  const { t, as, applicationId } = await setup();
  const shop = {
    pan,
    gstRegistered: true,
    gstin,
    ownerName: "Test Owner",
    shopName: "Test Business",
    address: "12 Test Street, Bengaluru",
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
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(payload()))
    .mockResolvedValue(
      Response.json({
        success: true,
        status_code: 200,
        data: {
          gstin,
          gstin_status: "Active",
          business_name: shop.shopName,
          legal_name: shop.shopName,
          address: shop.address,
        },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    as.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  expect(fetcher).not.toHaveBeenCalled();
  await as.action(api.identityDiscovery.lookup, {
    applicationId,
    consent: true,
  });
  await expect(
    as.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.mutation(api.identityDiscovery.select, { applicationId, gstin });
  await as.action(api.identityChecks.lookupGst, {
    applicationId,
    consent: true,
  });
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.mutation(api.identityChecks.confirmGst, { applicationId, gstin });
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { ...shop, pan: "AAAAA1111A" },
  });
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { ...shop, pan: "" },
  });
  await expect(
    as.mutation(api.applications.submit, { applicationId }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.action(api.identityChecks.lookupGst, {
    applicationId,
    consent: true,
  });
  await as.mutation(api.identityChecks.confirmGst, { applicationId, gstin });
  await as.mutation(api.applications.submit, { applicationId });
  const activated = await t.run((ctx) =>
    ctx.db.get("applications", applicationId),
  );
  expect(activated?.status).toBe("approved");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("returns an empty list without positive proof and refuses inactive registrations", async () => {
  const { t, as, applicationId } = await setup();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload([]))));
  expect(
    await as.action(api.identityDiscovery.lookup, {
      applicationId,
      consent: true,
    }),
  ).toEqual({ pan, registrations: [] });
  expect(
    await as.query(api.identityDiscovery.current, { applicationId }),
  ).toBeNull();
  expect(
    await t.run((ctx) => ctx.db.query("identityChecks").unique()),
  ).toMatchObject({ status: "failed" });
  const audit = await t.run((ctx) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) =>
        q.eq("entityTable", "applications").eq("entityId", applicationId),
      )
      .take(20),
  );
  expect(
    audit.find((event) => event.action === "identity.discovery_finished")
      ?.metadata,
  ).toMatchObject({ verified: false });
  const other = await setup();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        payload([
          {
            gstin,
            state: "Karnataka",
            state_code: "29",
            active_status: "Cancelled",
          },
        ]),
      ),
    ),
  );
  await other.as.action(api.identityDiscovery.lookup, {
    applicationId: other.applicationId,
    consent: true,
  });
  await expect(
    other.as.mutation(api.identityDiscovery.select, {
      applicationId: other.applicationId,
      gstin,
    }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
});
it("rejects other accounts, missing verified phones, admin and nonbusiness drafts without transport", async () => {
  const { t, as, applicationId } = await setup();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const stranger = await signIn(t, {
    email: "stranger@phone.luma.green",
    phoneNumber: "+919000000002",
  });
  await stranger.mutation(api.identity.ensureProfile, { locale: "en" });
  await expect(
    stranger.query(api.identityDiscovery.current, { applicationId }),
  ).rejects.toThrow("NO_APPLICATION");
  await expect(
    stranger.action(api.identityDiscovery.lookup, {
      applicationId,
      consent: true,
    }),
  ).rejects.toThrow("NO_APPLICATION");
  await expect(
    stranger.mutation(api.identityDiscovery.select, { applicationId, gstin }),
  ).rejects.toThrow("NO_APPLICATION");
  const noPhone = await signIn(t, { email: "no-phone@example.test" });
  await expect(
    noPhone.query(api.identityDiscovery.current, { applicationId }),
  ).rejects.toThrow("PHONE_REQUIRED");
  await t.run(async (ctx) => {
    const app = await ctx.db.get("applications", applicationId);
    if (!app) throw new Error("fixture");
    await ctx.db.patch("profiles", app.profileId, { kind: "admin" });
  });
  await expect(
    as.action(api.identityDiscovery.lookup, { applicationId, consent: true }),
  ).rejects.toThrow("NOT_A_MEMBER");
  const second = await setup();
  await second.t.run((ctx) =>
    ctx.db.patch("applications", second.applicationId, {
      kind: "saathi",
      kabadiwala: undefined,
    }),
  );
  await expect(
    second.as.action(api.identityDiscovery.lookup, {
      applicationId: second.applicationId,
      consent: true,
    }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  expect(fetcher).not.toHaveBeenCalled();
});
it("shares the account quota with GST checks and charges timeouts once without retries", async () => {
  const { t, as, applicationId } = await setup();
  const ids = await t.run(async (ctx) => {
    const app = await ctx.db.get("applications", applicationId);
    if (!app) throw new Error("fixture");
    const { _id, _creationTime, ...draft } = app;
    return Promise.all(
      Array.from({ length: 20 }, () =>
        ctx.db.insert("applications", {
          ...draft,
          panDiscoveryRequired: undefined,
          kabadiwala: { gstRegistered: true, gstin },
        }),
      ),
    );
  });
  await Promise.all(
    ids.slice(0, 19).map((id) =>
      as.mutation(internal.identityChecks.reserve, {
        applicationId: id,
        kind: "gst",
      }),
    ),
  );
  const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    as.action(api.identityDiscovery.lookup, { applicationId, consent: true }),
  ).rejects.toThrow("CHECK_UNAVAILABLE");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(
    as.mutation(internal.identityChecks.reserve, {
      applicationId: ids[19],
      kind: "gst",
    }),
  ).rejects.toThrow("CHECK_LIMIT");
  expect(
    await t.run((ctx) => ctx.db.query("identityPersonCheckDays").unique()),
  ).toMatchObject({ used: 20 });
});
it("rejects malformed, oversized and PAN-mismatched rows and deduplicates exact rows", () => {
  const row = {
    gstin,
    state: "Karnataka",
    state_code: "29",
    active_status: "Active",
  };
  expect(
    registrationsFrom(payload(Array.from({ length: 101 }, () => row)), pan),
  ).toBeNull();
  expect(
    registrationsFrom(payload([{ ...row, gstin: "29AAAAA1111A1Z5" }]), pan),
  ).toBeNull();
  expect(
    registrationsFrom(payload([{ ...row, state_code: "08" }]), pan),
  ).toBeNull();
  expect(
    registrationsFrom(payload([{ ...row, state: "x".repeat(101) }]), pan),
  ).toBeNull();
  expect(registrationsFrom(payload([row, row]), pan)).toEqual([registration]);
});

it("preserves historical direct-GST drafts and allows cleared optional PAN to return to direct GST", async () => {
  const { t, as, applicationId } = await setup();
  // Simulate a persisted pre-feature draft: the old optional PAN was never discovery proof.
  await t.run((ctx) =>
    ctx.db.patch("applications", applicationId, {
      panDiscoveryRequired: undefined,
      kabadiwala: { gstRegistered: true, pan: "AAAAA1111A", gstin },
    }),
  );
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      success: true,
      status_code: 200,
      data: {
        gstin,
        gstin_status: "Active",
        business_name: "Test Business",
        legal_name: "Test Business",
        address: "12 Test Street, Bengaluru",
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    as.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
  ).resolves.toMatchObject({ gstin });
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { gstRegistered: true, pan, gstin },
  });
  await expect(
    as.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
  ).rejects.toThrow("VALIDATION_REQUIRED");
  await as.mutation(api.applications.saveDraft, {
    applicationId,
    kabadiwala: { gstRegistered: true, gstin },
  });
  await expect(
    as.action(api.identityChecks.lookupGst, { applicationId, consent: true }),
  ).resolves.toMatchObject({ gstin });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

function deferredResponse() {
  let resolveResponse: ((value: Response) => void) | null = null;
  // eslint-disable-next-line unicorn/prefer-promise-with-resolvers -- The Convex test TypeScript target does not include Promise.withResolvers.
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  return {
    promise,
    resolve(value: Response) {
      if (!resolveResponse) throw new Error("Response not initialized");
      resolveResponse(value);
    },
  };
}

it.each(["unregistered", "approved"] as const)(
  "settles a pending lookup after the application becomes %s without exposing its result",
  async (change) => {
    const { t, as, applicationId } = await setup();
    const pending = deferredResponse();
    const fetcher = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetcher);
    const request = as.action(api.identityDiscovery.lookup, {
      applicationId,
      consent: true,
    });
    const rejected = expect(request).rejects.toThrow(
      change === "approved" ? "NOT_EDITABLE" : "VALIDATION_REQUIRED",
    );
    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
    if (change === "unregistered")
      await as.mutation(api.applications.saveDraft, {
        applicationId,
        kabadiwala: { gstRegistered: false },
      });
    else
      await t.run((ctx) =>
        ctx.db.patch("applications", applicationId, { status: "approved" }),
      );
    pending.resolve(Response.json(payload()));
    await rejected;
    const row = await t.run((ctx) => ctx.db.query("identityChecks").unique());
    expect(row).toMatchObject({ status: "failed" });
    expect(row?.registrations).toBeUndefined();
    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "applications").eq("entityId", applicationId),
        )
        .take(20),
    );
    expect(
      audit.find((event) => event.action === "identity.discovery_finished")
        ?.metadata,
    ).toMatchObject({ verified: false });
    if (change === "approved")
      await t.run((ctx) =>
        ctx.db.patch("applications", applicationId, { status: "draft" }),
      );
    await as.mutation(api.applications.saveDraft, {
      applicationId,
      kabadiwala: { gstRegistered: true, pan },
    });
    await expect(
      as.mutation(internal.identityDiscovery.reserve, { applicationId }),
    ).rejects.toThrow("CHECK_PENDING");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
    await expect(
      as.mutation(internal.identityDiscovery.reserve, { applicationId }),
    ).resolves.toMatchObject({ input: pan });
  },
);
