import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const review = z.object({
  reviewedAt: z.iso.datetime(),
  sha256,
  sourceDigest: sha256,
  method: z.literal("original-png-at-readable-resolution"),
  noSensitivePixels: z.literal(true),
  layoutPassed: z.literal(true),
});
const capture = z.object({
  name: z.string(),
  path: z.string(),
  route: z.string(),
  locale: z.enum(["en", "ar", "kn"]),
  theme: z.enum(["light", "dark"]),
  viewport: z.object({ width: z.number().int(), height: z.number().int() }),
  captureKind: z.enum(["viewport", "section"]),
  section: z.string().optional(),
  persona: z.string(),
  authenticated: z.boolean(),
  observedState: z.string().min(10),
  sha256,
  sourceDigest: sha256,
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
const diagnostics = z.object({
  browserErrors: z.literal(0),
  blockedRequests: z.literal(0),
  blockedWrites: z.literal(0),
  profileCalls: z.number().int().nonnegative(),
  authRateLimits: z.literal(0),
  authUnavailable: z.literal(0),
});
const skipped = z.object({ name: z.string(), reason: z.string() });
const manifest = z.object({
  version: z.literal(1),
  kind: z.literal("current-local-connected"),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  sourceHashes: z.record(z.string(), sha256),
  sourceDigest: sha256,
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
  captureSchedule: z.object({
    viewsPerBatch: z.literal(4),
    quietMilliseconds: z.literal(11_000),
  }),
  capturedAt: z.iso.datetime(),
  provenance: z.string(),
  authentication: z.literal("actual-browser-email-password"),
  writes: z.literal(
    "Authentication session lifecycle and the UI's existing identity.ensureProfile only",
  ),
  emailDelivery: z.literal("Not exercised; existing verified email accounts"),
  externalProvidersTested: z.literal(false),
  cloudDeploymentTested: z.literal(false),
  trace: z.literal(false),
  video: z.literal(false),
  storageStateSaved: z.literal(false),
  visualReview: z.literal("passed"),
  diagnostics: z.array(diagnostics),
  captures: z.array(capture),
  skipped: z.array(skipped),
});

interface PlannedCase {
  route: string;
  persona: string;
  kind: "viewport" | "section";
  reasons: string[];
  onlyArabic?: boolean;
}
const workspaceMissing = "No selected workspace with current membership";
const cases: Record<string, PlannedCase> = {
  "email-signin": {
    route: "/login",
    persona: "signed-out",
    kind: "viewport",
    reasons: [],
  },
  "email-signup": {
    route: "/login",
    persona: "signed-out",
    kind: "viewport",
    reasons: [],
  },
  "email-security": {
    route: "/account/security",
    persona: "applicant",
    kind: "viewport",
    reasons: [],
  },
  "kabadiwala-requests": {
    route: "/app/requests",
    persona: "kabadiwala",
    kind: "viewport",
    reasons: [],
  },
  "workspace-owner": {
    route: "/account/workspaces",
    persona: "kabadiwala",
    kind: "section",
    reasons: [workspaceMissing],
  },
  "workspace-invite": {
    route: "/account/workspaces",
    persona: "kabadiwala",
    kind: "section",
    reasons: [workspaceMissing],
  },
  "workspace-viewer": {
    route: "/account/workspaces",
    persona: "team-viewer",
    kind: "section",
    reasons: [
      workspaceMissing,
      "Existing account is not a viewer of its selected workspace",
    ],
  },
  "stakeholder-request": {
    route: "/join/stakeholder",
    persona: "applicant",
    kind: "viewport",
    reasons: ["Applicant already has a stakeholder request"],
  },
  "stakeholder-account-options": {
    route: "/join/stakeholder",
    persona: "applicant",
    kind: "viewport",
    reasons: ["Applicant already has a stakeholder request"],
    onlyArabic: true,
  },
  "stakeholder-site-options": {
    route: "/join/stakeholder",
    persona: "applicant",
    kind: "viewport",
    reasons: ["Applicant already has a stakeholder request"],
    onlyArabic: true,
  },
  "stakeholder-status": {
    route: "/join/stakeholder",
    persona: "apartment",
    kind: "viewport",
    reasons: ["No existing stakeholder request"],
  },
  "preprocessor-home": {
    route: "/app",
    persona: "preprocessor",
    kind: "viewport",
    reasons: [],
  },
  "preprocessor-market": {
    route: "/app/market",
    persona: "preprocessor",
    kind: "viewport",
    reasons: [],
  },
  "preprocessor-stock": {
    route: "/app/stock",
    persona: "preprocessor",
    kind: "viewport",
    reasons: [],
  },
  "preprocessor-trades": {
    route: "/app/trades",
    persona: "preprocessor",
    kind: "viewport",
    reasons: [],
  },
  "gateway-accepted": {
    route: "/app/trades",
    persona: "preprocessor",
    kind: "section",
    reasons: ["No existing accepted trade in the current trade tab"],
  },
};
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];
const planned = new Map<
  string,
  PlannedCase & {
    locale: string;
    viewport: { width: number; height: number };
    theme: string;
  }
>(
  Object.entries(cases).flatMap(([scenario, details]) =>
    (details.onlyArabic ? ["ar"] : ["en", "ar", "kn"]).flatMap((locale) =>
      viewports.flatMap((viewport) =>
        ["light", "dark"].map(
          (theme) =>
            [
              `refinement-${scenario}-${locale}-${String(viewport.width)}-${theme}`,
              { ...details, locale, viewport, theme },
            ] as const,
        ),
      ),
    ),
  ),
);
const hash = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(?:ts|tsx|css|js|webp|png|svg|woff2)$/.test(file) &&
      !/\.(?:test|spec)\./.test(file)
      ? [file]
      : [];
  });
}

function readEvidence() {
  return manifest.parse(
    JSON.parse(
      readFileSync("docs/user-guide/refinement-captures.json", "utf8"),
    ) as unknown,
  );
}

// This contract intentionally fails while captures or visual review are incomplete.
// The review record is an attestation; tests verify its exact byte/source binding,
// while a person or agent must still inspect every original browser PNG.
describe("current connected local refinement guide evidence", () => {
  it("accounts for every planned screen, script, width and theme exactly once", () => {
    const evidence = readEvidence();
    const names = [...evidence.captures, ...evidence.skipped].map(
      ({ name }) => name,
    );
    expect(planned.size).toBe(264);
    expect(new Set(names).size).toBe(names.length);
    expect(names.toSorted((a, b) => a.localeCompare(b))).toEqual(
      planned
        .keys()
        .toArray()
        .toSorted((a, b) => a.localeCompare(b)),
    );
    for (const item of evidence.captures) {
      const expected = planned.get(item.name);
      expect(expected, item.name).toBeDefined();
      expect(item).toMatchObject({
        route: expected?.route,
        persona: expected?.persona,
        captureKind: expected?.kind,
        locale: expected?.locale,
        viewport: expected?.viewport,
        theme: expected?.theme,
        authenticated: expected?.persona !== "signed-out",
        path: `docs/user-guide/screenshots/${item.name}.png`,
      });
      expect(item.section !== undefined).toBe(item.captureKind === "section");
      expect(item.renderedFont.family).toBe(
        { en: "Geist", ar: "Noto Sans Arabic", kn: "Noto Sans Kannada" }[
          item.locale
        ],
      );
    }
    for (const item of evidence.skipped)
      expect(planned.get(item.name)?.reasons, item.name).toContain(item.reason);
  });

  it("uses only the approved isolated local environment and honest execution limits", () => {
    const evidence = readEvidence();
    expect(
      evidence.backendOrigins.toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["http://127.0.0.1:3210", "http://127.0.0.1:3211"]);
    expect(evidence.diagnostics).toHaveLength(6);
    expect(evidence.provenance).toContain("Unmodified browser screenshots");
    expect(evidence.provenance).toContain("existing synthetic domain records");
    expect(evidence.provenance).toContain(
      "creates no domain records or invitations",
    );
    expect(evidence.provenance).toContain(
      "Sessions come only from real sign-in",
    );
  });

  it("hashes the complete current public source set without private credentials", () => {
    const evidence = readEvidence();
    const files = [
      "scripts/capture-refinement-guide.mts",
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
    for (const file of files)
      expect(
        hash(readFileSync(file)),
        `${file}: recapture the changed source`,
      ).toBe(evidence.sourceHashes[file]);
    expect(hash(JSON.stringify(evidence.sourceHashes))).toBe(
      evidence.sourceDigest,
    );
  });

  it("retains original PNG pixels and a completed review bound to each image", () => {
    const evidence = readEvidence();
    for (const item of evidence.captures) {
      const bytes = readFileSync(item.path);
      expect(bytes.subarray(0, 8).toString("hex"), item.name).toBe(
        "89504e470d0a1a0a",
      );
      expect(hash(bytes), item.name).toBe(item.sha256);
      expect(item.sourceDigest, item.name).toBe(evidence.sourceDigest);
      expect(item.review.sha256, item.name).toBe(item.sha256);
      expect(item.review.sourceDigest, item.name).toBe(item.sourceDigest);
      expect(
        Date.parse(item.review.reviewedAt),
        item.name,
      ).toBeGreaterThanOrEqual(Date.parse(item.capturedAt));
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
      if (item.captureKind === "viewport") {
        expect({ width, height }, item.name).toEqual(item.viewport);
      } else {
        expect(width, item.name).toBeGreaterThan(0);
        expect(width, item.name).toBeLessThanOrEqual(item.viewport.width);
        expect(height, item.name).toBeGreaterThan(0);
        expect(height, item.name).toBeLessThanOrEqual(2400);
      }
    }
  });

  it("keeps contact details, authentication material and saved sessions out of evidence metadata", () => {
    const evidence = readEvidence();
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toMatch(
      /@|otpauth:|(?:token|password|code)=|\.env|credentials\.json|backend\.env/i,
    );
    for (const item of evidence.captures)
      expect(item.route).not.toMatch(/[?#]/);
  });
});
