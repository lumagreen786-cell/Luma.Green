import { z } from "zod";

export const healthSnapshot = z.object({
  api: z.literal("up"),
  sms: z.enum(["unavailable", "accepted", "failed", "unknown"]),
  observedAt: z.number().nullable(),
  checkedAt: z.number(),
});
export type HealthSnapshot = z.infer<typeof healthSnapshot>;

/** Invalid and stale replies cannot report a healthy API. */
export async function readServiceStatus(url: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Health check failed");
  const snapshot = healthSnapshot.parse(await response.json());
  if (Math.abs(Date.now() - snapshot.checkedAt) > 60_000) {
    throw new Error("Health check is stale");
  }
  return snapshot;
}
