import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  isBookableDate,
  isWindowOpen,
  SLOT_WINDOW_HOURS,
  SLOT_WINDOWS,
  type SlotWindow,
} from "./households";
import { indiaToday } from "./onboarding";

export const DEFAULT_WINDOW_CAPACITY = 20;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export function isWithinPublishedHours(
  org: Pick<Doc<"orgs">, "hours" | "weeklyOff">,
  date: string,
  window: SlotWindow,
): boolean {
  const hours = org.hours;
  if (!hours) return false;
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  if (org.weeklyOff.includes(weekday)) return false;
  const [start, end] = SLOT_WINDOW_HOURS[window];
  return (
    hours.opens <= `${String(start).padStart(2, "0")}:00` &&
    hours.closes >= `${String(end).padStart(2, "0")}:00`
  );
}
export async function availableCapacity(
  ctx: QueryCtx,
  org: Doc<"orgs">,
  date: string,
  window: SlotWindow,
  excludeId?: Id<"bookings">,
): Promise<number> {
  const settings = await ctx.db
    .query("collectionAvailability")
    .withIndex("by_org", (q) => q.eq("orgId", org._id))
    .unique();
  const now = Date.now();
  if (
    org.status !== "active" ||
    !isBookableDate(date, indiaToday(now)) ||
    !isWindowOpen(date, window, indiaToday(now), now) ||
    !isWithinPublishedHours(org, date, window) ||
    settings?.holidayDates.includes(date) ||
    !(settings?.enabledWindows ?? SLOT_WINDOWS).includes(window)
  )
    return 0;
  const capacity = settings?.capacityPerWindow ?? DEFAULT_WINDOW_CAPACITY;
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_org_date_window", (q) =>
      q.eq("orgId", org._id).eq("slotDate", date).eq("slotWindow", window),
    )
    .take(1001);
  if (bookings.length > 1000) return 0;
  const used = bookings.filter(
    (b) =>
      b._id !== excludeId &&
      ["requested", "accepted", "on_the_way"].includes(b.status),
  ).length;
  return Math.max(0, capacity - used);
}
export async function requireCollectionCapacity(
  ctx: QueryCtx,
  org: Doc<"orgs">,
  date: string,
  window: SlotWindow,
  excludeId?: Id<"bookings">,
) {
  if ((await availableCapacity(ctx, org, date, window, excludeId)) < 1)
    throw new ConvexError("SLOT_UNAVAILABLE");
}

export function canServeCollection(
  org: Pick<Doc<"orgs">, "offersPickup">,
  mode: "pickup" | "dropoff",
): boolean {
  return org.offersPickup || mode !== "pickup";
}
