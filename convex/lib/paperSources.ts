import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const PAPER_SOURCE_CHUNK_BYTES = 512 * 1024;
export const PAPER_SOURCE_MAX_BYTES = 100 * 1024 * 1024;
export const PAPER_SOURCE_MAX_COUNT = 100;
function corrupt(): never {
  throw new ConvexError("PAPER_SOURCE_INTEGRITY");
}
/** Runs only inside the upload transaction: bytes, pointer and accounting commit together. */
export async function retainPaperSource(
  ctx: MutationCtx,
  args: { draftId: Id<"paperDrafts">; orgId: Id<"orgs">; bytes: ArrayBuffer },
) {
  const size = args.bytes.byteLength;
  if (size < 1 || size > 4 * PAPER_SOURCE_CHUNK_BYTES) corrupt();
  const usage = await ctx.db
    .query("paperSourceUsage")
    .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
    .unique();
  const usedBytes = usage?.usedBytes ?? 0;
  const sourceCount = usage?.sourceCount ?? 0;
  if (
    usedBytes + size > PAPER_SOURCE_MAX_BYTES ||
    sourceCount + 1 > PAPER_SOURCE_MAX_COUNT
  )
    throw new ConvexError("PAPER_CAPACITY");
  const next = { usedBytes: usedBytes + size, sourceCount: sourceCount + 1 };
  if (usage) await ctx.db.patch(usage._id, next);
  else await ctx.db.insert("paperSourceUsage", { orgId: args.orgId, ...next });
  const ids: Id<"paperSourceChunks">[] = [];
  for (let offset = 0; offset < size; offset += PAPER_SOURCE_CHUNK_BYTES) {
    ids.push(
      await ctx.db.insert("paperSourceChunks", {
        orgId: args.orgId,
        draftId: args.draftId,
        position: ids.length,
        bytes: args.bytes.slice(
          offset,
          Math.min(size, offset + PAPER_SOURCE_CHUNK_BYTES),
        ),
      }),
    );
  }
  return ids;
}
/** Bounded lookup through immutable source IDs, never a global storage scan. */
async function ownedChunks(ctx: QueryCtx, row: Doc<"paperDrafts">) {
  if (
    row.chunkIds.length === 0 ||
    row.chunkIds.length > 4 ||
    new Set(row.chunkIds).size !== row.chunkIds.length
  )
    corrupt();
  const chunks = await Promise.all(
    row.chunkIds.map((id) => ctx.db.get("paperSourceChunks", id)),
  );
  for (const [position, chunk] of chunks.entries()) {
    if (
      chunk?.orgId !== row.orgId ||
      chunk.draftId !== row._id ||
      chunk.position !== position ||
      chunk.bytes.byteLength > PAPER_SOURCE_CHUNK_BYTES
    )
      corrupt();
  }
  return chunks.map((chunk) => {
    if (!chunk) corrupt();
    return chunk;
  });
}
export async function readPaperSource(ctx: QueryCtx, row: Doc<"paperDrafts">) {
  const chunks = await ownedChunks(ctx, row);
  const size = chunks.reduce(
    (total, chunk) => total + chunk.bytes.byteLength,
    0,
  );
  if (size !== row.size || size > 4 * PAPER_SOURCE_CHUNK_BYTES) corrupt();
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(new Uint8Array(chunk.bytes), offset);
    offset += chunk.bytes.byteLength;
  }
  return bytes.buffer;
}
/** Caller deletes the unconfirmed draft in the same transaction; repeated cleanup finds no row. */
export async function releasePaperSource(
  ctx: MutationCtx,
  row: Doc<"paperDrafts">,
) {
  if (row.status === "confirmed") throw new ConvexError("PAPER_CONFIRMED");
  const chunks = await ownedChunks(ctx, row);
  const usage = await ctx.db
    .query("paperSourceUsage")
    .withIndex("by_org", (q) => q.eq("orgId", row.orgId))
    .unique();
  if (!usage || usage.usedBytes < row.size || usage.sourceCount < 1) corrupt();
  for (const chunk of chunks) await ctx.db.delete(chunk._id);
  await ctx.db.patch(usage._id, {
    usedBytes: usage.usedBytes - row.size,
    sourceCount: usage.sourceCount - 1,
  });
}
