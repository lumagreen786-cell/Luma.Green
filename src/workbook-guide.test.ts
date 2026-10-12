import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { workbookGuideCases } from "../scripts/workbook-guide-plan";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const review = z.object({
  reviewedAt: z.iso.datetime(),
  sha256: digest,
  sourceDigest: digest,
  method: z.literal("original-png-at-readable-resolution"),
  noSensitivePixels: z.literal(true),
  layoutPassed: z.literal(true),
});
const diagnosticsSchema = z.object({
  browserErrors: z.literal(0),
  blockedRequests: z.literal(0),
  blockedWrites: z.literal(0),
  authRateLimits: z.literal(0),
  authUnavailable: z.literal(0),
  profileCalls: z.number().int().nonnegative(),
});
const captureSchema = z.object({
  name: z.string(),
  path: z.string(),
  route: z.string(),
  locale: z.enum(["en", "ar", "kn"]),
  theme: z.enum(["light", "dark"]),
  viewport: z.object({ width: z.number().int(), height: z.number().int() }),
  captureKind: z.literal("viewport"),
  persona: z.string(),
  authenticated: z.literal(true),
  observedState: z.string().min(15),
  sha256: digest,
  sourceDigest: digest,
  capturedAt: z.iso.datetime(),
  privacyCheck: z.literal("passed"),
  renderedFont: z.object({
    family: z.string(),
    custom: z.literal(true),
    glyphCount: z.number().int().positive(),
  }),
  visualReview: z.literal("passed"),
  review,
});
const evidenceSchema = z.object({
  version: z.literal(1),
  kind: z.literal("current-local-connected"),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  sourceHashes: z.record(z.string(), digest),
  sourceDigest: digest,
  origin: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.origin === value
    );
  }, "Capture origin must be a loopback HTTP origin"),
  backendOrigins: z.array(z.string()),
  siteAgreement: z.literal(true),
  authentication: z.literal("actual-browser-email-password-and-admin-totp"),
  writes: z.literal(
    "Authentication session lifecycle and the UI's existing identity.ensureProfile only",
  ),
  externalProvidersTested: z.literal(false),
  cloudDeploymentTested: z.literal(false),
  trace: z.literal(false),
  video: z.literal(false),
  storageStateSaved: z.literal(false),
  visualReview: z.literal("passed"),
  skipped: z.array(z.never()),
  diagnostics: z.array(diagnosticsSchema),
  captures: z.array(captureSchema),
});
const hash = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
function readEvidence() {
  return evidenceSchema.parse(
    JSON.parse(
      readFileSync("docs/user-guide/workbook-captures.json", "utf8"),
    ) as unknown,
  );
}
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|css|js|webp|png|svg|woff2)$/.test(path) &&
      !/\.(?:test|spec)\./.test(path)
      ? [path]
      : [];
  });
}
const planned = workbookGuideCases.flatMap((item) =>
  (item.persona === "admin" ? ["en"] : ["en", "ar", "kn"]).flatMap((locale) =>
    [390, 768, 1440].flatMap((width) =>
      ["light", "dark"].map((theme) => ({
        name: `workbook-${item.name}-${locale}-${String(width)}-${theme}`,
        route: item.route,
        persona: item.persona,
        locale,
        width,
        theme,
        description: item.description,
      })),
    ),
  ),
);

// These gates deliberately fail until final captures and human/agent inspection
// exist. A manifest never counts as a visual review merely because it was written.
describe("current workbook workflow visual evidence", () => {
  it("covers every new-route state and English-only admin state exactly once", () => {
    const evidence = readEvidence();
    expect(planned).toHaveLength(342);
    expect(evidence.captures).toHaveLength(planned.length);
    expect(new Set(evidence.captures.map((x) => x.name)).size).toBe(
      planned.length,
    );
    for (const expected of planned) {
      const image = evidence.captures.find((x) => x.name === expected.name);
      expect(image, expected.name).toMatchObject({
        route: expected.route,
        persona: expected.persona,
        locale: expected.locale,
        theme: expected.theme,
        viewport: { width: expected.width },
        observedState: expected.description,
        path: `docs/user-guide/screenshots/${expected.name}.png`,
      });
    }
    expect(evidence.diagnostics).toHaveLength(6);
    expect(
      evidence.backendOrigins.toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["http://127.0.0.1:3210", "http://127.0.0.1:3211"]);
  });
  it("binds each original PNG and its manual review to current source", () => {
    const evidence = readEvidence();
    for (const image of evidence.captures) {
      expect(hash(readFileSync(image.path)), image.name).toBe(image.sha256);
      expect(image.sourceDigest).toBe(evidence.sourceDigest);
      expect(image.review.sha256).toBe(image.sha256);
      expect(image.review.sourceDigest).toBe(evidence.sourceDigest);
      expect(Date.parse(image.review.reviewedAt)).toBeGreaterThanOrEqual(
        Date.parse(image.capturedAt),
      );
      expect(image.renderedFont.family).toBe(
        { en: "Geist", ar: "Noto Sans Arabic", kn: "Noto Sans Kannada" }[
          image.locale
        ],
      );
    }
    const files = [
      "scripts/capture-workbook-guide.mts",
      "scripts/workbook-guide-plan.ts",
      "e2e/connected/totp.ts",
      "next.config.ts",
      "package.json",
      "messages/en.json",
      "messages/ar.json",
      "messages/kn.json",
      ...sourceFiles("src"),
      ...sourceFiles("convex"),
      ...sourceFiles("public"),
    ].toSorted((a, b) => a.localeCompare(b));
    expect(Object.keys(evidence.sourceHashes)).toEqual(files);
    for (const path of files)
      expect(hash(readFileSync(path)), path).toBe(evidence.sourceHashes[path]);
    expect(hash(JSON.stringify(evidence.sourceHashes))).toBe(
      evidence.sourceDigest,
    );
  });
});
