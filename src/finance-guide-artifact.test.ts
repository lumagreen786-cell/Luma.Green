import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";
const hash = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
it("retains all reviewed financial interface originals with exact source hashes", () => {
  const evidence = JSON.parse(
    readFileSync("docs/user-guide/finance-fixture-captures.json", "utf8"),
  ) as {
    sourceHashes: Record<string, string>;
    buildStyles: Record<string, string>;
    screenshots: {
      file: string;
      sha256: string;
      authenticated: boolean;
      providerExecutionTested: boolean;
      writesAttempted: boolean;
      sourceKind: string;
      blockedRequests: number;
      browserErrors: number;
    }[];
    visualReview: { status: string };
  };
  expect(evidence.screenshots).toHaveLength(36);
  expect(evidence.visualReview.status).toBe("passed");
  expect(Object.keys(evidence.buildStyles).length).toBeGreaterThan(0);
  const expected = ["en", "ar", "kn"].flatMap((locale) =>
    ["light", "dark"].flatMap((theme) =>
      [390, 768, 1440].flatMap((width) =>
        ["authorized-dispatch", "financial-hold"].map(
          (scenario) =>
            `screenshots/finance-fixture-${scenario}-${locale}-${theme}-${String(width)}.png`,
        ),
      ),
    ),
  );
  expect(
    evidence.screenshots
      .map(({ file }) => file)
      .toSorted((a, b) => a.localeCompare(b)),
  ).toEqual(expected.toSorted((a, b) => a.localeCompare(b)));
  for (const [file, digest] of Object.entries(evidence.sourceHashes))
    expect(hash(file), file).toBe(digest);
  for (const screenshot of evidence.screenshots) {
    expect(hash(`docs/user-guide/${screenshot.file}`)).toBe(screenshot.sha256);
    expect(screenshot.sourceKind).toBe("synthetic-financial-interface-example");
    expect(screenshot.authenticated).toBe(false);
    expect(screenshot.providerExecutionTested).toBe(false);
    expect(screenshot.writesAttempted).toBe(false);
    expect(screenshot.blockedRequests).toBe(0);
    expect(screenshot.browserErrors).toBe(0);
  }
});
