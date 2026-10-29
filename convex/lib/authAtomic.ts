import type { GenericCtx } from "@convex-dev/better-auth";
import type { DBAdapter, DBAdapterInstance } from "better-auth/adapters";
import {
  type ApiFromModules,
  componentsGeneric,
  createFunctionHandle,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";
import { z } from "zod";

import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import type { Id } from "../betterAuth/_generated/dataModel";
import type * as atomic from "../betterAuth/atomic";

// Public exports inside a component are internal references in its parent's API.
// Derive only these exact references without changing generated component files.
type AtomicApi = ApiFromModules<{ atomic: typeof atomic }>["atomic"];
type ParentReference<F extends FunctionReference<"mutation">> =
  FunctionReference<
    "mutation",
    "internal",
    FunctionArgs<F>,
    FunctionReturnType<F>
  >;
const atomicComponent = componentsGeneric() as unknown as {
  betterAuth: {
    atomic: {
      incrementOne: ParentReference<AtomicApi["incrementOne"]>;
      consumeRateLimit: ParentReference<AtomicApi["consumeRateLimit"]>;
    };
  };
};
const equality = {
  operator: z.literal("eq").optional(),
  connector: z.literal("AND").optional(),
  mode: z.literal("sensitive").optional(),
};
const conjunction = {
  connector: z.literal("AND").optional(),
  mode: z.literal("sensitive").optional(),
};
const idGuard = z.strictObject({
  field: z.literal("id"),
  value: z.string().min(1),
  ...equality,
});
const keyGuard = z.strictObject({
  field: z.literal("key"),
  value: z.string(),
  ...equality,
});
const expiredGuard = z.strictObject({
  field: z.literal("lockedUntil"),
  value: z.date(),
  operator: z.literal("lte"),
  ...conjunction,
});
const backupGuard = z.strictObject({
  field: z.literal("backupCodes"),
  value: z.string(),
  ...equality,
});
const observedGuard = z.strictObject({
  field: z.literal("lastRequest"),
  value: z.int().nonnegative(),
  operator: z.literal("lte"),
  ...conjunction,
});
const windowGuard = z.strictObject({
  field: z.literal("lastRequest"),
  value: z.int().nonnegative(),
  operator: z.literal("gt"),
  ...conjunction,
});
const countGuard = z.strictObject({
  field: z.literal("count"),
  value: z.int().nonnegative(),
  operator: z.literal("lt"),
  ...conjunction,
});
const atomicUpdate = z.union([
  z
    .strictObject({
      model: z.literal("twoFactor"),
      where: z.tuple([idGuard]),
      increment: z.strictObject({ failedVerificationCount: z.literal(1) }),
      set: z.undefined().optional(),
    })
    .transform(({ where }) => ({
      model: "twoFactor" as const,
      factorId: where[0].value,
      operation: { kind: "increment" as const },
    })),
  z
    .strictObject({
      model: z.literal("twoFactor"),
      where: z.tuple([idGuard, expiredGuard]),
      increment: z.strictObject({}),
      set: z.strictObject({
        failedVerificationCount: z.literal(0),
        lockedUntil: z.null(),
      }),
    })
    .transform(({ where }) => ({
      model: "twoFactor" as const,
      factorId: where[0].value,
      operation: {
        kind: "resetExpired" as const,
        expiredAtMs: where[1].value.getTime(),
      },
    })),
  z
    .strictObject({
      model: z.literal("twoFactor"),
      where: z.tuple([idGuard, backupGuard]),
      increment: z.strictObject({}),
      set: z.strictObject({ backupCodes: z.string() }),
    })
    .transform(({ where, set }) => ({
      model: "twoFactor" as const,
      factorId: where[0].value,
      operation: {
        kind: "replaceBackupCodes" as const,
        expectedBackupCodes: where[1].value,
        backupCodes: set.backupCodes,
      },
    })),
  z
    .strictObject({
      model: z.literal("rateLimit"),
      where: z.tuple([keyGuard, observedGuard]),
      increment: z.strictObject({}),
      set: z.strictObject({
        count: z.literal(1),
        lastRequest: z.int().nonnegative(),
      }),
    })
    .transform(({ where, set }) => ({
      model: "rateLimit" as const,
      key: where[0].value,
      operation: {
        kind: "reset" as const,
        observedAtMs: where[1].value,
        now: set.lastRequest,
      },
    })),
  z
    .strictObject({
      model: z.literal("rateLimit"),
      where: z.tuple([keyGuard, windowGuard, countGuard]),
      increment: z.strictObject({ count: z.literal(1) }),
      set: z.strictObject({ lastRequest: z.int().nonnegative() }),
    })
    .transform(({ where, set }) => ({
      model: "rateLimit" as const,
      key: where[0].value,
      operation: {
        kind: "consume" as const,
        windowStart: where[1].value,
        maximum: where[2].value,
        now: set.lastRequest,
      },
    })),
]);
type Increment = Parameters<DBAdapter["incrementOne"]>[0];

/** Replace only supported auth increments; never use a stale fallback for them. */
export function withAtomicAuthUpdates(
  ctx: GenericCtx<DataModel>,
  factory: DBAdapterInstance,
): DBAdapterInstance {
  return (options) => {
    const base = factory(options);
    return {
      ...base,
      incrementOne: async <T>(input: Increment): Promise<T | null> => {
        if (input.model !== "twoFactor" && input.model !== "rateLimit")
          return base.incrementOne<T>(input);
        const parsed = atomicUpdate.safeParse(input);
        if (!parsed.success || !("runMutation" in ctx))
          throw new Error("Unsupported atomic auth update.");
        const update = parsed.data;
        if (update.model === "rateLimit") {
          const result = await ctx.runMutation(
            atomicComponent.betterAuth.atomic.consumeRateLimit,
            { key: update.key, operation: update.operation },
          );
          if (!result) return null;
          const mapped = await base.findOne<Record<string, unknown>>({
            model: "rateLimit",
            where: [{ field: "id", value: result.rowId }],
          });
          return mapped
            ? ({
                ...mapped,
                count: result.count,
                lastRequest: result.lastRequest,
              } as T)
            : null;
        }
        const operation =
          update.operation.kind === "replaceBackupCodes"
            ? {
                ...update.operation,
                onUpdateHandle: await createFunctionHandle(
                  internal.authEvents.onUpdate,
                ),
              }
            : update.operation;
        const result = await ctx.runMutation(
          atomicComponent.betterAuth.atomic.incrementOne,
          {
            // Convex's v.id validator checks the table identity at the boundary.
            factorId: update.factorId as Id<"twoFactor">,
            operation,
          },
        );
        if (!result) return null;
        // Retain the adapter's id/date mapping, but return this write's exact
        // changed fields even if another write completes before this read.
        const mapped = await base.findOne<Record<string, unknown>>({
          model: "twoFactor",
          where: [{ field: "id", value: update.factorId }],
        });
        return mapped ? ({ ...mapped, ...result } as T) : null;
      },
    };
  };
}
