import { afterEach, expect, it, vi } from "vitest";

import { runPrivateStockReport } from "../trigger/private-stock-report";
import { api } from "./_generated/api";

const spies = vi.hoisted(() => ({ mutation: vi.fn(), connect: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ task: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = spies.mutation;
    constructor(url: string) {
      spies.connect(url);
    }
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const payload = { jobId: "job-fixture", capability: "a".repeat(64) };
it("prepares actual CSV from fetched private rows and returns no private output", async () => {
  vi.stubEnv("TRIGGER_CONVEX_URL", "https://test-project.convex.cloud");
  spies.mutation
    .mockResolvedValueOnce([
      { materialCode: "PAPER", grams: 1001 },
      { materialCode: "METAL", grams: 1 },
    ])
    .mockResolvedValueOnce(null);
  expect(await runPrivateStockReport(payload)).toEqual({ completed: true });
  expect(spies.connect).toHaveBeenCalledWith(
    "https://test-project.convex.cloud",
  );
  expect(spies.mutation).toHaveBeenNthCalledWith(
    1,
    api.reportJobs.start,
    payload,
  );
  expect(spies.mutation).toHaveBeenNthCalledWith(2, api.reportJobs.complete, {
    ...payload,
    result: "material_code,grams\nMETAL,1\nPAPER,1001\n",
  });
});
it.each([
  "",
  // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- Test rejects an insecure endpoint.
  "http://test-project.convex.cloud",
  "https://evil.example",
  "https://test-project.convex.cloud:1234",
  "https://test-project.convex.cloud/path",
])("rejects an unavailable or untrusted Convex endpoint: %s", async (url) => {
  vi.stubEnv("TRIGGER_CONVEX_URL", url);
  await expect(runPrivateStockReport(payload)).rejects.toThrow();
  expect(spies.connect).not.toHaveBeenCalled();
});
it("rejects injected owner/context input before contacting Convex", async () => {
  vi.stubEnv("TRIGGER_CONVEX_URL", "https://test-project.convex.cloud");
  await expect(
    runPrivateStockReport({ ...payload, orgId: "forged" }),
  ).rejects.toThrow();
  expect(spies.mutation).not.toHaveBeenCalled();
});
it("propagates a transient Convex failure so Trigger can use its bounded retries", async () => {
  vi.stubEnv("TRIGGER_CONVEX_URL", "https://test-project.convex.cloud");
  spies.mutation.mockRejectedValueOnce(new Error("NETWORK_UNAVAILABLE"));
  await expect(runPrivateStockReport(payload)).rejects.toThrow(
    "NETWORK_UNAVAILABLE",
  );
  expect(spies.mutation).toHaveBeenCalledTimes(1);
});
