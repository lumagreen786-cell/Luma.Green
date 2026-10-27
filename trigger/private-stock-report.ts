import { task } from "@trigger.dev/sdk";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { stockCsv } from "../convex/lib/reportJobs";

const input = z
  .object({
    jobId: z.string().min(1).max(100),
    capability: z.string().regex(/^[\da-f]{64}$/),
  })
  .strict();
export async function runPrivateStockReport(payload: unknown) {
  const args = input.parse(payload);
  const url = new URL(
    process.env.TRIGGER_CONVEX_URL ?? "https://unconfigured.invalid",
  );
  if (
    url.protocol !== "https:" ||
    Boolean(url.port) ||
    !/^[a-z0-9-]+\.convex\.cloud$/.test(url.hostname) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("JOBS_UNAVAILABLE");
  const client = new ConvexHttpClient(url.origin);
  const capability = {
    jobId: args.jobId as Id<"reportJobs">,
    capability: args.capability,
  };
  const rows = await client.mutation(api.reportJobs.start, capability);
  await client.mutation(api.reportJobs.complete, {
    ...capability,
    result: stockCsv(rows),
  });
  return { completed: true };
}

export const privateStockReport = task({
  id: "private-stock-report",
  maxDuration: 60,
  retry: { maxAttempts: 3 },
  queue: { concurrencyLimit: 2 },
  run: runPrivateStockReport,
});
