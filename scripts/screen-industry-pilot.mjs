import { readFile } from "node:fs/promises";

import { z } from "zod";

import { industryPilotIntake } from "./validate-industry-pilot.mjs";

const label = z.string().trim().min(1).max(160);
const amount = z.int().nonnegative();
const mass = z.int().positive();
const scopes = ["scope_1", "scope_2_location", "scope_2_market", "scope_3"];

const batch = z.strictObject({
  reference: label,
  outputStream: label,
  inputGrams: mass,
  outputGrams: mass,
  lossGrams: amount,
});
const quote = z.strictObject({
  buyer: label,
  stream: label,
  permission: z.enum(["reviewed", "unreviewed"]),
  permissionReference: label.optional(),
  minimumGrams: amount,
  maximumGrams: mass,
  quotedPaise: amount,
  freightPaise: amount,
  handlingPaise: amount,
});
const inventoryRow = z
  .strictObject({
    scope: z.enum(scopes),
    category: z.int().min(1).max(15).optional(),
    kgCo2e: amount,
    source: label,
  })
  .refine((row) => (row.scope === "scope_3") === (row.category !== undefined));
const climate = z.strictObject({
  inventoryBoundary: label,
  period: label,
  inventory: z.array(inventoryRow).max(1000),
  projectEstimateKgCo2e: z.int().optional(),
});
const pilot = z.strictObject({
  intake: industryPilotIntake,
  batch,
  quotes: z.array(quote).max(100),
  climate,
});

function safeInteger(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("UNSAFE_TOTAL");
  return number;
}

export function screenIndustryPilot(input) {
  const {
    intake,
    batch: measured,
    quotes,
    climate: accounting,
  } = pilot.parse(input);
  if (
    BigInt(measured.outputGrams) + BigInt(measured.lossGrams) !==
    BigInt(measured.inputGrams)
  ) {
    throw new Error("MASS_BALANCE_MISMATCH");
  }
  const outputDeclared = intake.wasteStreams.some(
    (stream) =>
      stream.direction === "output" && stream.name === measured.outputStream,
  );
  if (!outputDeclared) throw new Error("OUTPUT_STREAM_NOT_DECLARED");

  const candidates = quotes
    .filter(
      (entry) =>
        entry.stream === measured.outputStream &&
        entry.permission === "reviewed" &&
        entry.permissionReference !== undefined &&
        measured.outputGrams >= entry.minimumGrams &&
        measured.outputGrams <= entry.maximumGrams,
    )
    .map((entry) => ({
      buyer: entry.buyer,
      netQuotePaise: safeInteger(
        BigInt(entry.quotedPaise) -
          BigInt(entry.freightPaise) -
          BigInt(entry.handlingPaise),
      ),
    }))
    .toSorted((left, right) => right.netQuotePaise - left.netQuotePaise);

  const inventory = Object.fromEntries(
    scopes.map((scope) => {
      const rows = accounting.inventory.filter((row) => row.scope === scope);
      const total = rows.reduce((sum, row) => sum + BigInt(row.kgCo2e), 0n);
      return [scope, rows.length > 0 ? safeInteger(total) : null];
    }),
  );
  return {
    status: "unverified_local_screen",
    route: intake.route,
    batchReference: measured.reference,
    quotes: candidates,
    inventoryBoundary: accounting.inventoryBoundary,
    period: accounting.period,
    inventory,
    projectEstimateKgCo2e: accounting.projectEstimateKgCo2e ?? null,
    baseCreditRevenuePaise: 0,
  };
}

if (import.meta.main) {
  try {
    if (process.argv.length === 3) {
      const report = screenIndustryPilot(
        JSON.parse(await readFile(process.argv[2], "utf8")),
      );
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    } else {
      process.stderr.write(
        "Usage: node scripts/screen-industry-pilot.mjs pilot.json\n",
      );
      process.exitCode = 1;
    }
  } catch {
    process.stderr.write(
      "Pilot screening failed. Check the input format, stream and quantities.\n",
    );
    process.exitCode = 1;
  }
}
