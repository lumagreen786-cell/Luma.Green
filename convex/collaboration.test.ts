/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { convexModules, signIn } from "./lib/auth.testing";
import { teamWorld } from "./lib/teams.testing";

const modules = convexModules(import.meta.glob("./**/*.*s"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function world() {
  vi.stubEnv("AUTH_DEV_MODE", "true");
  const { t, owner, other, orgId, otherOrgId } = await teamWorld(modules);
  const person = await signIn(t, {
    email: "collaborator@example.test",
    phoneNumber: "+919123456788",
  });
  const profileId = await person.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const membershipId = await t.run((ctx) =>
    ctx.db.insert("memberships", {
      profileId,
      orgId,
      role: "member",
      createdAt: Date.now(),
    }),
  );
  const jobId = await t.run((ctx) =>
    ctx.db.insert("jobs", {
      orgId,
      kind: "yard_sorting",
      title: "Demo job",
      area: "Demo",
      date: "2026-10-15",
      window: "morning",
      payPaise: 100,
      status: "open",
      createdAt: Date.now(),
    }),
  );
  const scope = { kind: "workspace" as const, id: orgId };
  const record = { kind: "job" as const, id: jobId };
  const taskId = await owner.mutation(api.collaboration.createTask, {
    scope,
    record,
    title: "Sort demo material",
    assignedTo: profileId,
  });
  return {
    t,
    owner,
    other,
    person,
    profileId,
    membershipId,
    orgId,
    otherOrgId,
    scope,
    record,
    taskId,
  };
}
const paginationOpts = { numItems: 10, cursor: null };
describe("record collaboration", () => {
  it("keeps discussions within the record's site and denies guessed IDs", async () => {
    const w = await world();
    await w.person.mutation(api.collaboration.comment, {
      taskId: w.taskId,
      body: "Ready for sorting",
      mentions: [],
    });
    const comments = await w.owner.query(api.collaboration.comments, {
      taskId: w.taskId,
      paginationOpts,
    });
    expect(comments.page).toHaveLength(1);
    await expect(
      w.other.query(api.collaboration.comments, {
        taskId: w.taskId,
        paginationOpts,
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await expect(
      w.other.query(api.collaboration.tasks, {
        scope: { kind: "workspace", id: w.otherOrgId },
        record: w.record,
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
  });
  it("revocation blocks reads and writes, even for an assigned user", async () => {
    const w = await world();
    await w.t.run((ctx) => ctx.db.delete("memberships", w.membershipId));
    await expect(
      w.person.query(api.collaboration.comments, {
        taskId: w.taskId,
        paginationOpts,
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await expect(
      w.person.mutation(api.collaboration.comment, {
        taskId: w.taskId,
        body: "Still assigned",
        mentions: [],
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await expect(
      w.owner.mutation(api.collaboration.comment, {
        taskId: w.taskId,
        body: "Mention removed user",
        mentions: [w.profileId],
      }),
    ).rejects.toThrow("INVALID_MENTION");
  });
  it("lets viewers read without writing and rejects inaccessible assignments", async () => {
    const w = await world();
    await w.t.run((ctx) =>
      ctx.db.patch("memberships", w.membershipId, { role: "viewer" }),
    );
    expect(
      await w.person.query(api.collaboration.tasks, {
        scope: w.scope,
        record: w.record,
      }),
    ).toHaveLength(1);
    await expect(
      w.person.mutation(api.collaboration.comment, {
        taskId: w.taskId,
        body: "A write",
        mentions: [],
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await expect(
      w.owner.mutation(api.collaboration.updateTask, {
        taskId: w.taskId,
        expectedVersion: 1,
        title: "Still work",
        state: "open",
        assignedTo: w.profileId,
      }),
    ).rejects.toThrow("INVALID_ASSIGNEE");
  });
  it("rejects lost updates without changing the underlying job state", async () => {
    const w = await world();
    await w.person.mutation(api.collaboration.updateTask, {
      taskId: w.taskId,
      expectedVersion: 1,
      title: "Sorted material",
      state: "done",
    });
    await expect(
      w.owner.mutation(api.collaboration.updateTask, {
        taskId: w.taskId,
        expectedVersion: 1,
        title: "Stale title",
        state: "open",
      }),
    ).rejects.toThrow("STALE_VERSION");
    expect(
      await w.t.run((ctx) => ctx.db.get("jobs", w.record.id)),
    ).toMatchObject({ status: "open", payPaise: 100 });
    expect(
      await w.owner.query(api.collaboration.activity, { taskId: w.taskId }),
    ).toHaveLength(2);
  });
  it("preserves comment revisions and limits edit and moderation powers", async () => {
    const w = await world();
    const commentId = await w.owner.mutation(api.collaboration.comment, {
      taskId: w.taskId,
      body: "Original",
      mentions: [w.profileId],
    });
    await expect(
      w.person.mutation(api.collaboration.editComment, {
        commentId,
        expectedVersion: 1,
        body: "Impersonation",
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await w.owner.mutation(api.collaboration.editComment, {
      commentId,
      expectedVersion: 1,
      body: "Corrected",
    });
    await expect(
      w.owner.mutation(api.collaboration.editComment, {
        commentId,
        expectedVersion: 1,
        body: null,
      }),
    ).rejects.toThrow("STALE_VERSION");
    await w.owner.mutation(api.collaboration.editComment, {
      commentId,
      expectedVersion: 2,
      body: null,
    });
    const comments = await w.person.query(api.collaboration.comments, {
      taskId: w.taskId,
      paginationOpts,
    });
    expect(comments.page[0]).toMatchObject({
      body: "",
      deleted: true,
      mentions: [],
      version: 3,
    });
    expect(
      await w.t.run((ctx) => ctx.db.query("recordCommentRevisions").collect()),
    ).toHaveLength(2);
  });
  it("bounds comments, mentions and dates", async () => {
    const w = await world();
    await expect(
      w.owner.mutation(api.collaboration.comment, {
        taskId: w.taskId,
        body: "x".repeat(2001),
        mentions: [],
      }),
    ).rejects.toThrow("INVALID_MESSAGE");
    await expect(
      w.owner.mutation(api.collaboration.updateTask, {
        taskId: w.taskId,
        expectedVersion: 1,
        title: "Due date",
        state: "open",
        dueAt: 0.5,
      }),
    ).rejects.toThrow("INVALID_DUE_DATE");
    for (let index = 0; index < 12; index++)
      await w.owner.mutation(api.collaboration.comment, {
        taskId: w.taskId,
        body: "Bounded comment",
        mentions: [],
      });
    await expect(
      w.owner.mutation(api.collaboration.comment, {
        taskId: w.taskId,
        body: "Too many",
        mentions: [],
      }),
    ).rejects.toThrow("COMMENT_RATE_LIMITED");
  });
  it("limits Saathi discussion access to the currently assigned job", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      await ctx.db.delete("memberships", w.membershipId);
      const saathiProfileId = await ctx.db.insert("saathiProfiles", {
        profileId: w.profileId,
        name: "Demo worker",
        city: "Demo",
        area: "Demo",
        radiusKm: 2,
        workTypes: ["yard_sorting"],
        vehicle: "none",
        times: ["morning"],
        days: [],
        status: "active",
        createdAt: Date.now(),
      });
      await ctx.db.patch("jobs", w.record.id, {
        saathiProfileId,
        status: "assigned",
      });
    });
    await w.person.mutation(api.collaboration.comment, {
      taskId: w.taskId,
      body: "Assigned job note",
      mentions: [],
    });
    await expect(
      w.person.mutation(api.collaboration.createTask, {
        scope: w.scope,
        record: w.record,
        title: "Cannot manage site",
      }),
    ).rejects.toThrow("TEAM_ACCESS_DENIED");
    await w.t.run((ctx) =>
      ctx.db.patch("jobs", w.record.id, { saathiProfileId: undefined }),
    );
    await expect(
      w.person.query(api.collaboration.comments, {
        taskId: w.taskId,
        paginationOpts,
      }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
  });
  it("rejects a stale form after the selected workspace changes", async () => {
    const w = await world();
    await w.t.run((ctx) =>
      ctx.db.patch("profiles", w.profileId, { activeOrgId: w.otherOrgId }),
    );
    await expect(
      w.person.mutation(api.collaboration.comment, {
        taskId: w.taskId,
        body: "Stale form",
        mentions: [],
      }),
    ).rejects.toThrow("WORKSPACE_CHANGED");
  });
  it("allows an internal team without making its members platform administrators", async () => {
    const w = await world();
    vi.stubEnv("ADMIN_EMAIL", "platform@example.test");
    const admin = await signIn(w.t, {
      email: "platform@example.test",
      phoneNumber: "+919123456787",
      twoFactorEnabled: true,
    });
    await admin.mutation(api.identity.ensureProfile, { locale: "en" });
    const parent = await admin.mutation(api.organizations.create, {
      kind: "internal",
      name: "Luma internal",
    });
    await w.t.run((ctx) =>
      ctx.db.insert("organizationMemberships", {
        organizationId: parent,
        profileId: w.profileId,
        role: "member",
        createdAt: Date.now(),
      }),
    );
    const taskId = await w.person.mutation(api.collaboration.createTask, {
      scope: { kind: "organization", id: parent },
      record: { kind: "internal", id: parent },
      title: "Review demo operations",
    });
    await w.person.mutation(api.collaboration.comment, {
      taskId,
      body: "Internal team note",
      mentions: [],
    });
    await expect(
      w.owner.query(api.collaboration.comments, { taskId, paginationOpts }),
    ).rejects.toThrow("RECORD_ACCESS_DENIED");
    await expect(
      w.person.mutation(api.organizations.create, {
        kind: "internal",
        name: "Another team",
      }),
    ).rejects.toThrow("NOT_ADMIN");
  });
});

describe("collaboration notifications", () => {
  it("notifies the assignee once per comment and hides notices after revocation", async () => {
    const w = await world();
    expect(await w.person.query(api.inbox.unreadCount, {})).toBe(1);
    await w.owner.mutation(api.collaboration.comment, {
      taskId: w.taskId,
      body: "Please check this task",
      mentions: [w.profileId],
    });
    const before = await w.person.query(api.inbox.list, { paginationOpts });
    expect(before.page).toHaveLength(2);
    expect(before.page.every((row) => row.taskId === w.taskId)).toBe(true);
    const first = before.page[0];
    await w.t.run((ctx) => ctx.db.delete("memberships", w.membershipId));
    const after = await w.person.query(api.inbox.list, { paginationOpts });
    expect(after.page).toHaveLength(0);
    expect(await w.person.query(api.inbox.unreadCount, {})).toBe(0);
    await expect(
      w.person.mutation(api.inbox.markRead, { id: first.id }),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("deduplicates due reminders and rejects stale, finished and revoked tasks", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T06:00:00Z"));
    const w = await world();
    await w.t.run((ctx) =>
      ctx.db.patch("recordTasks", w.taskId, { dueAt: Date.now() - 1 }),
    );
    const args = { taskId: w.taskId, version: 1 };
    await w.t.mutation(internal.collaborationReminders.due, args);
    await w.t.mutation(internal.collaborationReminders.due, args);
    expect(await w.person.query(api.inbox.unreadCount, {})).toBe(2);
    await w.t.run((ctx) =>
      ctx.db.patch("recordTasks", w.taskId, { version: 2, state: "done" }),
    );
    await w.t.mutation(internal.collaborationReminders.due, args);
    await w.t.mutation(internal.collaborationReminders.due, {
      ...args,
      version: 2,
    });
    expect(await w.person.query(api.inbox.unreadCount, {})).toBe(2);
    await w.t.run(async (ctx) => {
      await ctx.db.patch("recordTasks", w.taskId, {
        version: 3,
        state: "open",
      });
      await ctx.db.delete("memberships", w.membershipId);
    });
    await w.t.mutation(internal.collaborationReminders.due, {
      ...args,
      version: 3,
    });
    expect(
      await w.t.run((ctx) => ctx.db.query("inbox").collect()),
    ).toHaveLength(2);
  });
  it("cancels pending web push after record access is revoked", async () => {
    vi.useFakeTimers();
    try {
      const w = await world();
      vi.stubEnv("WEB_PUSH_ENABLED", "true");
      vi.stubEnv("WEB_PUSH_SUBJECT", "mailto:ops@example.test");
      vi.stubEnv("WEB_PUSH_PUBLIC_KEY", "a".repeat(87));
      vi.stubEnv("WEB_PUSH_PRIVATE_KEY", "b".repeat(43));
      await w.person.mutation(api.push.registerWeb, {
        installationId: "11111111-1111-4111-8111-111111111111",
        locale: "en",
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/demo",
          keys: {
            p256dh: `B${"a".repeat(86)}`,
            auth: "a".repeat(22),
          },
        },
      });
      await w.owner.mutation(api.collaboration.comment, {
        taskId: w.taskId,
        body: "Notify assigned member",
        mentions: [],
      });
      const delivery = await w.t.run((ctx) =>
        ctx.db.query("pushDeliveries").unique(),
      );
      if (!delivery) throw new Error("Missing delivery");
      await w.t.run((ctx) => ctx.db.delete("memberships", w.membershipId));
      expect(
        await w.t.mutation(internal.pushState.claim, { id: delivery._id }),
      ).toBeNull();
      expect(
        await w.t.run((ctx) => ctx.db.get("pushDeliveries", delivery._id)),
      ).toMatchObject({ status: "cancelled" });
      await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }
  });
  it("runs a scheduled due reminder at the requested time", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-27T06:00:00Z"));
      const w = await world();
      await w.owner.mutation(api.collaboration.updateTask, {
        taskId: w.taskId,
        expectedVersion: 1,
        title: "Scheduled work",
        state: "open",
        assignedTo: w.profileId,
        dueAt: Date.now() + 60_000,
      });
      expect(await w.person.query(api.inbox.unreadCount, {})).toBe(2);
      await w.t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await w.person.query(api.inbox.unreadCount, {})).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
