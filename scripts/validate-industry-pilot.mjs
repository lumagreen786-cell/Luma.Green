import { readFile } from "node:fs/promises";

import { z } from "zod";

const label = z.string().trim().min(1).max(160);

const system = z.strictObject({
  name: label,
  version: label.optional(),
  access: z.enum(["manual", "file_export", "api", "unknown"]),
  exportFormat: label.optional(),
});
const equipment = z.strictObject({
  name: label,
  make: label.optional(),
  model: label.optional(),
  unit: label.optional(),
  calibrationReference: label.optional(),
});
const wasteStream = z.strictObject({
  name: label,
  direction: z.enum(["input", "output", "residue"]),
  currentDestination: label.optional(),
  permitReference: label.optional(),
});

export const industryPilotIntake = z.strictObject({
  schemaVersion: z.literal(1),
  route: z.enum(["dry_recycling", "compressed_biogas"]),
  facility: z.strictObject({
    operator: label,
    site: label,
    state: label,
    district: label,
    serviceCity: label,
  }),
  processLine: label,
  systems: z.array(system).max(50),
  equipment: z.array(equipment).max(100),
  wasteStreams: z.array(wasteStream).min(1).max(100),
});

if (import.meta.main) {
  if (process.argv.length === 3) {
    try {
      const input = JSON.parse(await readFile(process.argv[2], "utf8"));
      const result = industryPilotIntake.safeParse(input);
      if (result.success) {
        process.stdout.write(
          "Intake format passed. Facility evidence remains unverified.\n",
        );
      } else {
        for (const issue of result.error.issues) {
          process.stderr.write(
            `Invalid field: ${issue.path.join(".") || "intake"} (${issue.code})\n`,
          );
        }
        process.exitCode = 1;
      }
    } catch {
      process.stderr.write("The intake file could not be read as JSON.\n");
      process.exitCode = 1;
    }
  } else {
    process.stderr.write(
      "Usage: node scripts/validate-industry-pilot.mjs intake.json\n",
    );
    process.exitCode = 1;
  }
}
