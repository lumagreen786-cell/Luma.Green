/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { locales } from "../src/i18n/locales";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  convexModules,
  registerAuth,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import { queueNotification } from "./lib/notifications";
import { isValidEndpoint, isValidExpoToken, isValidWebKeys } from "./lib/push";
import { pushCopy } from "./lib/pushCopy";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const sendWeb = vi.hoisted(() => vi.fn());
vi.mock("web-push", () => ({ default: { sendNotification: sendWeb } }));
const installationId = "11111111-1111-4111-8111-111111111111";
const otherInstallation = "22222222-2222-4222-8222-222222222222";
const token = "ExpoPushToken[test_device_token]";
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
  keys: { p256dh: `B${"a".repeat(86)}`, auth: "a".repeat(22) },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function world() {
  vi.useFakeTimers();
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PUSH_ACCESS_TOKEN", "fake-test-token");
  vi.stubEnv("WEB_PUSH_ENABLED", "true");
  vi.stubEnv("WEB_PUSH_SUBJECT", "mailto:ops@example.com");
  vi.stubEnv("WEB_PUSH_PUBLIC_KEY", "a".repeat(87));
  vi.stubEnv("WEB_PUSH_PRIVATE_KEY", "b".repeat(43));
  vi.stubEnv("MSG91_AUTH_KEY", "");
  const t = convexTest(schema, modules);
  registerAuth(t);
  const alice = await signIn(t, {
    email: "alice@example.com",
    phoneNumber: "+919000000101",
  });
  const bob = await signIn(t, {
    email: "bob@example.com",
    phoneNumber: "+919000000102",
  });
  const aliceId = await alice.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const bobId = await bob.mutation(api.identity.ensureProfile, {
    locale: "ar",
  });
  const queue = (key = "event-1", profileId = aliceId) =>
    t.run((ctx) =>
      queueNotification(ctx, {
        profileId,
        event: "application_received",
        dedupKey: key,
        locale: "en",
        revision: 1,
      }),
    );
  return { t, alice, bob, aliceId, bobId, queue };
}

describe("push input boundaries", () => {
  it.each([
    ["http:", "", "fcm.googleapis.com", "x"].join("/"),
    "https://localhost/x",
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com.attacker.test/x",
    "https://fcm.googleapis.com@evil.test/x",
    "https://fcm.googleapis.com:444/x",
    "https://fcm.googleapis.com/x#fragment",
    "https://evil.test/x",
    String.raw`https://fcm.googleapis.com\@evil.test/x`,
  ])("rejects unsafe endpoint %s", (endpoint) => {
    expect(isValidEndpoint(endpoint)).toBe(false);
  });
  it.each([
    "https://fcm.googleapis.com/fcm/send/test",
    "https://updates.push.services.mozilla.com/wpush/v2/test",
    "https://web.push.apple.com/Q/test",
    "https://wns2-by3p.notify.windows.com/w/?token=test",
  ])("accepts known push host %s", (endpoint) => {
    expect(isValidEndpoint(endpoint)).toBe(true);
  });
  it("requires bounded Expo token and exact key lengths", () => {
    expect(isValidExpoToken(token)).toBe(true);
    expect(isValidExpoToken("ExponentPushToken[test_device]")).toBe(true);
    expect(isValidExpoToken("ExpoPushToken[bad value]")).toBe(false);
    expect(isValidExpoToken(`ExpoPushToken[${"a".repeat(300)}]`)).toBe(false);
    expect(isValidWebKeys(subscription.keys)).toBe(true);
    expect(isValidWebKeys({ ...subscription.keys, p256dh: "short" })).toBe(
      false,
    );
  });
  it("uses the exact shared lock-screen messages for every locale", () => {
    const messages: Record<string, unknown> = import.meta.glob(
      "../messages/*.json",
      { eager: true },
    );
    const schema = z.object({
      default: z.object({
        notifications: z.object({
          lockscreenTitle: z.string(),
          lockscreenBody: z.string(),
        }),
      }),
    });
    for (const locale of locales) {
      const message = new Map(Object.entries(messages)).get(
        `../messages/${locale}.json`,
      );
      expect(message).toBeDefined();
      if (!message) continue;
      const { notifications } = schema.parse(message).default;
      expect(pushCopy(locale)).toEqual({
        title: notifications.lockscreenTitle,
        body: notifications.lockscreenBody,
        locale,
      });
    }
  });
});

describe("private inbox", () => {
  it("records one event even with SMS and push off", async () => {
    const { t, alice, queue } = await world();
    vi.stubEnv("EXPO_PUSH_ENABLED", "false");
    vi.stubEnv("WEB_PUSH_ENABLED", "false");
    await queue();
    await queue();
    const result = await alice.query(api.inbox.list, {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(result.page).toHaveLength(1);
    expect(new Set(Object.keys(result.page[0] ?? {}))).toEqual(
      new Set(["createdAt", "event", "id", "read"]),
    );
    expect(
      await t.run((ctx) => ctx.db.query("pushDeliveries").collect()),
    ).toEqual([]);
    expect(await alice.query(api.inbox.unreadCount, {})).toBe(1);
  });
  it("requires a real session and isolates read actions by owner", async () => {
    const { t, alice, bob, queue } = await world();
    await queue();
    await expect(
      t.query(api.inbox.list, {
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    ).rejects.toThrow("NOT_SIGNED_IN");
    const result = await alice.query(api.inbox.list, {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    const id = result.page[0].id;
    const bobPage = await bob.query(api.inbox.list, {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(bobPage.page).toEqual([]);
    await expect(bob.mutation(api.inbox.markRead, { id })).rejects.toThrow(
      "NOT_FOUND",
    );
    await alice.mutation(api.inbox.markRead, { id });
    await alice.mutation(api.inbox.markRead, { id });
    expect(await alice.query(api.inbox.unreadCount, {})).toBe(0);
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) =>
          q.eq("entityTable", "inbox").eq("entityId", id),
        )
        .collect(),
    );
    expect(audits.map((row) => row.action)).toEqual([
      "inbox.created",
      "inbox.read",
    ]);
  });
  it("marks only the owner's entries and clamps oversized pages", async () => {
    const { alice, bob, bobId, queue } = await world();
    for (let index = 0; index < 55; index++)
      await queue(`event-${String(index)}`);
    await queue("bob-event", bobId);
    const page = await alice.query(api.inbox.list, {
      paginationOpts: { cursor: null, numItems: 500 },
    });
    expect(page.page).toHaveLength(50);
    expect(page.isDone).toBe(false);
    await alice.mutation(api.inbox.markAllRead, {});
    expect(await alice.query(api.inbox.unreadCount, {})).toBe(0);
    expect(await bob.query(api.inbox.unreadCount, {})).toBe(1);
  });
});

describe("push devices and delivery claims", () => {
  it("sends only generic Expo content and a fixed inbox destination", async () => {
    const { t, alice, queue } = await world();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(
          { data: { status: "ok", id: "receipt-1" } },
          { status: 200 },
        ),
      );
    await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    await queue();
    const delivery = await t.run((ctx) =>
      ctx.db.query("pushDeliveries").first(),
    );
    await t.action(internal.pushDelivery.send, { id: delivery!._id });
    const call = fetch.mock.calls.at(-1)!;
    expect(call[0]).toBe("https://exp.host/--/api/v2/push/send");
    const payload = JSON.parse(call[1]!.body as string);
    expect(payload).toEqual({
      to: token,
      title: "Luma.Green update",
      body: "Open Luma.Green to view your update.",
      data: { route: "/account/notifications" },
      channelId: "account-updates",
      sound: "default",
      ttl: 3600,
    });
    expect(await deliveryStatus(t, delivery!._id)).toBe("accepted");
    await t.action(internal.pushDelivery.send, { id: delivery!._id });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not retry an ambiguous transport failure", async () => {
    const { t, alice, queue } = await world();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("timeout"));
    await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    await queue();
    const delivery = await t.run((ctx) =>
      ctx.db.query("pushDeliveries").first(),
    );
    await t.action(internal.pushDelivery.send, { id: delivery!._id });
    await t.action(internal.pushDelivery.send, { id: delivery!._id });
    expect(fetch).toHaveBeenCalledOnce();
    expect(await deliveryStatus(t, delivery!._id)).toBe("unknown");
  });
  it("retires a Web Push subscription after a 410 provider rejection", async () => {
    const { t, alice, queue } = await world();
    sendWeb.mockRejectedValue({
      statusCode: 410,
      body: "private provider data",
    });
    const id = await alice.mutation(api.push.registerWeb, {
      subscription,
      locale: "en",
      installationId,
    });
    await queue();
    const delivery = await t.run((ctx) =>
      ctx.db.query("pushDeliveries").first(),
    );
    await t.action(internal.pushDelivery.send, { id: delivery!._id });
    expect(await t.run((ctx) => ctx.db.get("pushDevices", id))).toBeNull();
    const audit = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(JSON.stringify(audit)).not.toContain("private provider data");
  });
  it("restores idempotently, rotates within an installation, and revokes before restoration", async () => {
    const { t, alice } = await world();
    const id = await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    expect(
      await alice.mutation(api.push.registerExpo, {
        token,
        locale: "en",
        installationId,
      }),
    ).toBe(id);
    await alice.mutation(api.push.registerExpo, {
      token: "ExpoPushToken[rotated]",
      locale: "en",
      installationId,
    });
    expect(
      await t.run((ctx) => ctx.db.query("pushDevices").collect()),
    ).toHaveLength(1);
    await alice.mutation(api.push.unregisterInstallation, { installationId });
    await alice.mutation(api.push.unregisterInstallation, { installationId });
    expect(await t.run((ctx) => ctx.db.query("pushDevices").collect())).toEqual(
      [],
    );
  });
  it("prevents another account from revoking a shared installation or device", async () => {
    const { t, alice, bob } = await world();
    const id = await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    await bob.mutation(api.push.unregisterInstallation, { installationId });
    await expect(bob.mutation(api.push.unregister, { id })).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(await t.run((ctx) => ctx.db.get("pushDevices", id))).not.toBeNull();
  });
  it("never returns raw device tokens or keys in public settings", async () => {
    const { alice } = await world();
    await alice.mutation(api.push.registerWeb, {
      subscription,
      locale: "en",
      installationId,
    });
    expect(await alice.query(api.push.settings, {})).toEqual({
      webKey: "a".repeat(87),
      expo: true,
    });
  });
  it("does not register an invalid or disabled channel", async () => {
    const { alice } = await world();
    await expect(
      alice.mutation(api.push.registerWeb, {
        subscription: {
          ...subscription,
          endpoint: "https://localhost/private",
        },
        locale: "en",
        installationId,
      }),
    ).rejects.toThrow("INVALID_SUBSCRIPTION");
    await expect(
      alice.mutation(api.push.registerExpo, {
        token,
        locale: "en",
        installationId: "invalid",
      }),
    ).rejects.toThrow("INVALID_INSTALLATION");
    vi.stubEnv("EXPO_PUSH_ENABLED", "false");
    await expect(
      alice.mutation(api.push.registerExpo, {
        token,
        locale: "en",
        installationId,
      }),
    ).rejects.toThrow("PUSH_UNAVAILABLE");
  });
  it("claims once, and cancels queued work after logout", async () => {
    const { t, alice, queue } = await world();
    await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    await queue();
    const delivery = await t.run((ctx) =>
      ctx.db.query("pushDeliveries").first(),
    );
    await alice.mutation(api.push.unregisterInstallation, { installationId });
    expect(
      await t.mutation(internal.pushState.claim, { id: delivery!._id }),
    ).toBeNull();
    expect(await deliveryStatus(t, delivery!._id)).toBe("cancelled");
    await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    await queue("next-event");
    const next = await t.run((ctx) =>
      ctx.db.query("pushDeliveries").order("desc").first(),
    );
    expect(
      await t.mutation(internal.pushState.claim, { id: next!._id }),
    ).not.toBeNull();
    expect(
      await t.mutation(internal.pushState.claim, { id: next!._id }),
    ).toBeNull();
    await t.mutation(internal.pushState.expire, { id: next!._id });
    expect(await deliveryStatus(t, next!._id)).toBe("unknown");
  });
  it("cancels old-account delivery when a device changes account", async () => {
    const { t, alice, bob, queue } = await world();
    await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    await queue();
    await bob.mutation(api.push.registerExpo, {
      token,
      locale: "ar",
      installationId,
    });
    const delivery = await t.run((ctx) =>
      ctx.db.query("pushDeliveries").first(),
    );
    expect(
      await t.mutation(internal.pushState.claim, { id: delivery!._id }),
    ).toBeNull();
    const reassigned = await t.run((ctx) =>
      ctx.db.query("pushDevices").first(),
    );
    expect(reassigned?.profileId).not.toBe(delivery?.profileId);
    expect(reassigned).not.toBeNull();
  });
  it.each(["expired", "revoked", "unbound", "wrong-owner"] as const)(
    "cancels and audits an inactive %s session binding exactly once",
    async (state) => {
      const { t, alice, bob, queue } = await world();
      const id = await alice.mutation(api.push.registerExpo, {
        token,
        locale: "en",
        installationId,
      });
      const device = await t.run((ctx) => ctx.db.get("pushDevices", id));
      if (!device?.sessionId) throw new Error("Missing bound session fixture");
      const sessionId = device.sessionId;
      await queue();
      switch (state) {
        case "expired": {
          await t.run((ctx) =>
            ctx.runMutation(components.betterAuth.adapter.updateOne, {
              input: {
                model: "session",
                where: [{ field: "_id", value: sessionId }],
                update: { expiresAt: Date.now() },
              },
            }),
          );
          break;
        }
        case "revoked": {
          await deleteSession(t, device.sessionId);
          break;
        }
        case "unbound": {
          await t.run((ctx) => ctx.db.patch(id, { sessionId: undefined }));
          break;
        }
        case "wrong-owner": {
          const otherId = await bob.mutation(api.push.registerExpo, {
            token: "ExpoPushToken[bob_session]",
            locale: "ar",
            installationId: otherInstallation,
          });
          const other = await t.run((ctx) =>
            ctx.db.get("pushDevices", otherId),
          );
          await t.run((ctx) =>
            ctx.db.patch(id, { sessionId: other?.sessionId }),
          );
          break;
        }
      }
      const delivery = await t.run((ctx) =>
        ctx.db.query("pushDeliveries").first(),
      );
      if (!delivery) throw new Error("No delivery fixture");
      expect(
        await t.mutation(internal.pushState.claim, { id: delivery._id }),
      ).toBeNull();
      expect(
        await t.mutation(internal.pushState.claim, { id: delivery._id }),
      ).toBeNull();
      expect(await deliveryStatus(t, delivery._id)).toBe("cancelled");
      expect(await t.run((ctx) => ctx.db.get("pushDevices", id))).toBeNull();
      const audits = await t.run((ctx) => ctx.db.query("auditLog").collect());
      expect(
        audits.filter(
          (row) => row.entityId === id && row.action === "push.revoked",
        ),
      ).toHaveLength(1);
      expect(
        audits.filter(
          (row) =>
            row.entityId === delivery._id && row.action === "push.cancelled",
        ),
      ).toHaveLength(1);
      expect(audits.some((row) => row.action === "push.sending")).toBe(false);
    },
  );
  it("does not let stale registration cleanup remove the same device rebound to a new session", async () => {
    const { t, alice, bob } = await world();
    const registration = { token, locale: "en", installationId };
    const id = await alice.mutation(api.push.registerExpo, registration);
    const original = await t.run((ctx) => ctx.db.get("pushDevices", id));
    if (!original?.sessionId) throw new Error("Missing session fixture");
    const active = await signInAs(t, "+919000000101");
    expect(await active.mutation(api.push.registerExpo, registration)).toBe(id);
    const renewed = await t.run((ctx) => ctx.db.get("pushDevices", id));
    if (!renewed?.sessionId) throw new Error("Missing renewed session fixture");
    expect(renewed.sessionId).not.toBe(original.sessionId);
    await active.mutation(api.push.unregister, {
      id,
      expectedSessionId: original.sessionId,
    });
    expect(await t.run((ctx) => ctx.db.get("pushDevices", id))).toEqual(
      renewed,
    );
    await expect(
      bob.mutation(api.push.unregister, {
        id,
        expectedSessionId: renewed.sessionId,
      }),
    ).rejects.toThrow("NOT_FOUND");
    await active.mutation(api.push.unregister, {
      id,
      expectedSessionId: renewed.sessionId,
    });
    expect(await t.run((ctx) => ctx.db.get("pushDevices", id))).toBeNull();
  });
  it.each(["legacy", "new-session"] as const)(
    "rebinds a %s registration without cancelling same-owner queued content",
    async (state) => {
      const { t, alice, queue } = await world();
      const registration = { token, locale: "en", installationId };
      const id = await alice.mutation(api.push.registerExpo, registration);
      const original = await t.run((ctx) => ctx.db.get("pushDevices", id));
      if (!original?.sessionId)
        throw new Error("Missing bound session fixture");
      await queue();
      if (state === "legacy")
        await t.run((ctx) => ctx.db.patch(id, { sessionId: undefined }));
      const active =
        state === "legacy" ? alice : await signInAs(t, "+919000000101");
      expect(await active.mutation(api.push.registerExpo, registration)).toBe(
        id,
      );
      const renewed = await t.run((ctx) => ctx.db.get("pushDevices", id));
      expect(renewed?.sessionId).toBeDefined();
      if (state === "new-session") {
        expect(renewed?.sessionId).not.toBe(original.sessionId);
        await deleteSession(t, original.sessionId);
      }
      const delivery = await t.run((ctx) =>
        ctx.db.query("pushDeliveries").first(),
      );
      if (!delivery) throw new Error("No delivery fixture");
      expect(
        await t.mutation(internal.pushState.claim, { id: delivery._id }),
      ).toMatchObject({ deviceId: id });
      expect(
        await t.run((ctx) => ctx.db.get("pushDevices", id)),
      ).not.toBeNull();
    },
  );
  it.each(["revoked", "legacy"] as const)(
    "removes inactive %s bindings before applying the device quota",
    async (state) => {
      const { t, alice } = await world();
      for (let index = 0; index < 10; index++) {
        await alice.mutation(api.push.registerExpo, {
          token: `ExpoPushToken[old_${String(index)}]`,
          locale: "en",
          installationId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        });
      }
      const previous = await t.run((ctx) =>
        ctx.db.query("pushDevices").collect(),
      );
      if (!previous[0]?.sessionId)
        throw new Error("Missing bound session fixture");
      if (state === "revoked") await deleteSession(t, previous[0].sessionId);
      else
        await t.run(async (ctx) => {
          for (const device of previous)
            await ctx.db.patch(device._id, { sessionId: undefined });
        });
      const active = await signInAs(t, "+919000000101");
      const id = await active.mutation(api.push.registerExpo, {
        token,
        locale: "en",
        installationId,
      });
      const remaining = await t.run((ctx) =>
        ctx.db.query("pushDevices").collect(),
      );
      expect(remaining.map((device) => device._id)).toEqual([id]);
      const audits = await t.run((ctx) => ctx.db.query("auditLog").collect());
      expect(
        audits.filter((row) => row.action === "push.replaced"),
      ).toHaveLength(10);
    },
  );
  it("revoking one session preserves another active session's device", async () => {
    const { t, alice, queue } = await world();
    const oldId = await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    const oldDevice = await t.run((ctx) => ctx.db.get("pushDevices", oldId));
    if (!oldDevice?.sessionId) throw new Error("Missing bound session fixture");
    const otherSession = await signInAs(t, "+919000000101");
    const otherId = await otherSession.mutation(api.push.registerExpo, {
      token: "ExpoPushToken[other_live_session]",
      locale: "en",
      installationId: otherInstallation,
    });
    await deleteSession(t, oldDevice.sessionId);
    await queue();
    const deliveries = await t.run((ctx) =>
      ctx.db.query("pushDeliveries").collect(),
    );
    for (const delivery of deliveries) {
      const claimed = await t.mutation(internal.pushState.claim, {
        id: delivery._id,
      });
      if (delivery.deviceId === oldId) expect(claimed).toBeNull();
      else expect(claimed?.deviceId).toBe(otherId);
    }
    expect(deliveries).toHaveLength(2);
    expect(
      await t.run((ctx) => ctx.db.get("pushDevices", otherId)),
    ).not.toBeNull();
  });
  it("rejects registration when the session belongs to a different profile", async () => {
    const { t, alice, bob, aliceId } = await world();
    const bobDeviceId = await bob.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    const bobDevice = await t.run((ctx) =>
      ctx.db.get("pushDevices", bobDeviceId),
    );
    const profile = await t.run((ctx) => ctx.db.get("profiles", aliceId));
    if (!profile || !bobDevice?.sessionId)
      throw new Error("Missing owner fixture");
    const mismatched = t.withIdentity({
      subject: profile.authUserId,
      sessionId: bobDevice.sessionId,
    });
    await expect(
      mismatched.mutation(api.push.registerExpo, {
        token: "ExpoPushToken[mismatched]",
        locale: "en",
        installationId,
      }),
    ).rejects.toThrow("NOT_SIGNED_IN");
    // The valid owner's independent session is unaffected.
    expect(await alice.query(api.push.settings, {})).toMatchObject({
      expo: true,
    });
  });
  it.each(["send", "receipt"] as const)(
    "preserves a renewed binding after a late %s rejection",
    async (stage) => {
      const { t, alice, queue } = await world();
      const registration = { token, locale: "en", installationId };
      const id = await alice.mutation(api.push.registerExpo, registration);
      await queue();
      const delivery = await t.run((ctx) =>
        ctx.db.query("pushDeliveries").first(),
      );
      if (!delivery) throw new Error("Missing delivery fixture");
      expect(
        await t.mutation(internal.pushState.claim, { id: delivery._id }),
      ).toMatchObject({ deviceId: id });
      if (stage === "receipt")
        await t.mutation(internal.pushState.finish, {
          id: delivery._id,
          status: "accepted",
          removeDevice: false,
          receiptId: "old-receipt",
        });

      // A new session can restore the same token before an old response arrives.
      const active = await signInAs(t, "+919000000101");
      expect(await active.mutation(api.push.registerExpo, registration)).toBe(
        id,
      );
      const renewed = await t.run((ctx) => ctx.db.get("pushDevices", id));
      if (stage === "send")
        await t.mutation(internal.pushState.finish, {
          id: delivery._id,
          status: "failed",
          removeDevice: true,
        });
      else
        await t.mutation(internal.pushState.receipt, {
          id: delivery._id,
          receiptId: "old-receipt",
          rejected: true,
          removeDevice: true,
        });

      expect(await t.run((ctx) => ctx.db.get("pushDevices", id))).toEqual(
        renewed,
      );
      expect(await deliveryStatus(t, delivery._id)).toBe("failed");
    },
  );
  it("removes invalid subscriptions without removing another device", async () => {
    const { t, alice, queue } = await world();
    const id = await alice.mutation(api.push.registerExpo, {
      token,
      locale: "en",
      installationId,
    });
    const other = await alice.mutation(api.push.registerExpo, {
      token: "ExpoPushToken[other]",
      locale: "en",
      installationId: otherInstallation,
    });
    await queue();
    const delivery = await t.run(async (ctx) => {
      const rows = await ctx.db.query("pushDeliveries").collect();
      return rows.find((row) => row.deviceId === id);
    });
    await t.mutation(internal.pushState.claim, { id: delivery!._id });
    await t.mutation(internal.pushState.finish, {
      id: delivery!._id,
      status: "failed",
      removeDevice: true,
    });
    expect(await t.run((ctx) => ctx.db.get("pushDevices", id))).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.get("pushDevices", other)),
    ).not.toBeNull();
  });
});

async function deliveryStatus(
  t: Awaited<ReturnType<typeof world>>["t"],
  id: Id<"pushDeliveries">,
) {
  const row = await t.run((ctx) => ctx.db.get("pushDeliveries", id));
  return row?.status;
}

async function deleteSession(
  t: Awaited<ReturnType<typeof world>>["t"],
  sessionId: string,
) {
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "session", where: [{ field: "_id", value: sessionId }] },
      paginationOpts: { cursor: null, numItems: 1 },
    }),
  );
}
