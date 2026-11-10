/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { convexModules, registerAuth, signIn } from "./lib/auth.testing";
import { mockR2 } from "./lib/r2.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const SITE = "https://luma.green";
const pdf = "%PDF-1.7\nchecked test bytes\n";
function post(body = pdf) {
  return {
    method: "POST",
    headers: {
      Origin: SITE,
      "Content-Type": "application/octet-stream",
      "X-Luma-File-Name": "approval.pdf",
      "X-Luma-File-Size": String(body.length),
    },
    body,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("writes checked R2 bytes and keeps the application file private through removal", async () => {
  vi.stubEnv("SITE_URL", SITE);
  const r2 = mockR2();
  const t = convexTest(schema, modules);
  registerAuth(t);
  const owner = await signIn(t, {
    email: "own@luma.test",
    phoneNumber: "+919000000001",
  });
  const other = await signIn(t, {
    email: "other@luma.test",
    phoneNumber: "+919000000002",
  });
  await owner.mutation(api.identity.ensureProfile, { locale: "en" });
  const application = await owner.mutation(api.applications.start, {
    kind: "yard",
    locale: "en",
    ageConfirmed: true,
    privacyAccepted: true,
  });
  const url = "/application-uploads?type=pcb_certificate";
  const signedOut = await t.fetch(url, post());
  expect(signedOut.status).toBe(401);
  const wrongOwner = await other.fetch(
    `${url}&applicationId=${application}`,
    post(),
  );
  expect(wrongOwner.status).toBe(403);
  const badFormat = await owner.fetch(url, post("not a pdf"));
  expect(badFormat.status).toBe(400);
  expect(r2.objects.size).toBe(0);

  vi.stubEnv("R2_ENABLED", "false");
  const disabled = await owner.fetch(url, post());
  expect(disabled.status).toBe(503);
  expect(await disabled.json()).toEqual({
    ok: false,
    error: "uploadUnavailable",
  });
  await expect(
    owner.mutation(api.applicationFiles.generateUploadUrl, {}),
  ).rejects.toThrow("STORAGE_UNAVAILABLE");
  expect(r2.objects.size).toBe(0);
  vi.stubEnv("R2_ENABLED", "true");

  const response = await owner.fetch(url, post());
  expect(response.status).toBe(201);
  const result = (await response.json()) as { fileId: Id<"applicationFiles"> };
  const stored = await t.run((ctx) =>
    ctx.db.get("applicationFiles", result.fileId),
  );
  expect(stored?.storageId).toBeUndefined();
  expect(stored?.r2?.key).toMatch(/^application\//);
  expect(stored?.sha256).toMatch(/^[\da-f]{64}$/);
  expect(r2.objects.size).toBe(1);
  const download = `/files/${result.fileId}`;
  const denied = await other.fetch(download);
  expect(denied.status).toBe(403);
  const read = await owner.fetch(download);
  expect(read.status).toBe(200);
  expect(await read.text()).toBe(pdf);
  await t.run((ctx) =>
    ctx.db.patch("applicationFiles", result.fileId, {
      firstSubmittedVersion: 1,
    }),
  );
  const replacement = await owner.fetch(url, post("%PDF-1.7\nreplacement"));
  expect(replacement.status).toBe(201);
  const newer = (await replacement.json()) as {
    fileId: Id<"applicationFiles">;
  };
  const active = await owner.query(api.applications.mine, {});
  expect(active?.application?.files.map((file) => file.id)).toEqual([
    newer.fileId,
  ]);
  const historical = await owner.fetch(download);
  expect(await historical.text()).toBe(pdf);

  await owner.mutation(api.applicationFiles.remove, { fileId: newer.fileId });
  const removed = await owner.fetch(`/files/${newer.fileId}`);
  expect(removed.status).toBe(404);
  await t.action(internal.applicationFiles.expireR2, { fileId: newer.fileId });
  expect(r2.objects.size).toBe(1);
});

it("limits malformed uploads per profile before reading the next body", async () => {
  vi.stubEnv("SITE_URL", SITE);
  const r2 = mockR2();
  const t = convexTest(schema, modules);
  registerAuth(t);
  const owner = await signIn(t, {
    email: "own@luma.test",
    phoneNumber: "+919000000001",
  });
  await owner.mutation(api.identity.ensureProfile, { locale: "en" });
  await owner.mutation(api.applications.start, {
    kind: "yard",
    locale: "en",
    ageConfirmed: true,
    privacyAccepted: true,
  });

  const path = "/application-uploads?type=pcb_certificate";
  const invalid = post("not a pdf");
  invalid.headers["X-Luma-File-Size"] = String(10 * 1024 * 1024);
  const statuses = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await owner.fetch(path, invalid);
    statuses.push(response.status);
  }
  expect(statuses).toEqual(Array.from({ length: 30 }, () => 400));

  const getReader = vi.spyOn(ReadableStream.prototype, "getReader");
  const blocked = await owner.fetch(path, invalid);
  expect(blocked.status).toBe(429);
  expect(getReader).not.toHaveBeenCalled();
  expect(r2.fetcher).not.toHaveBeenCalled();
});
