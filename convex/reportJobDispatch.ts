import { v } from "convex/values";

import { triggerJobsConfig } from "../src/lib/env";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const dispatch = internalAction({
  args: { jobId: v.id("reportJobs"), capability: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const isAllowed: boolean = await ctx.runQuery(
      internal.reportJobs.dispatchAllowed,
      args,
    );
    const config = isAllowed ? triggerJobsConfig() : null;
    if (config) {
      try {
        const response = await fetch(
          "https://api.trigger.dev/api/v1/tasks/private-stock-report/trigger",
          {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
            headers: {
              Authorization: `Bearer ${config.secretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payload: args,
              options: { idempotencyKey: `stock-${args.jobId}`, ttl: "25m" },
            }),
          },
        );
        // An uncertain response may already have accepted the run. Expiry resolves it.
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        )
          await ctx.runMutation(internal.reportJobs.rejectDispatch, {
            jobId: args.jobId,
          });
        await response.body?.cancel();
      } catch {
        /* Dispatch is deliberately not retried; the job expires if no worker arrives. */
      }
    } else if (isAllowed) {
      await ctx.runMutation(internal.reportJobs.rejectDispatch, {
        jobId: args.jobId,
      });
    }
    return null;
  },
});
