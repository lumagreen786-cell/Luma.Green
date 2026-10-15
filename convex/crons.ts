import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";
import { PUBLIC_DATA_CITIES } from "./lib/publicData";

const crons = cronJobs();
// eslint-disable-next-line unicorn/no-top-level-side-effects -- Convex registers cron definitions at module load.
crons.interval(
  "quality-r2-cleanup",
  { minutes: 15 },
  internal.qualityFiles.cleanupR2,
  {},
);
for (const [index, city] of PUBLIC_DATA_CITIES.entries()) {
  // Stagger cities, avoiding the provider's busy top-of-hour period.
  crons.hourly(
    `public-data-${city.id}`,
    { minuteUTC: 7 + index * 8 },
    internal.publicData.refreshCity,
    { city: city.id },
  );
}
export default crons;
