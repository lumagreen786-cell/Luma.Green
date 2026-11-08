import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { z } from "zod";

const reference = z.string().trim().min(1).max(160);
const grams = z.number().int().nonnegative();
const reading = z.strictObject({ gramsCO2e: grams, reference });
const batch = z.strictObject({
  id: reference,
  sourceAllocations: z.array(reference).min(1).max(40),
  recordedOn: z.iso.date(),
  inputGrams: grams.positive(),
  eligibleOutputGrams: grams,
  otherOutputGrams: grams,
  rejectsGrams: grams,
  lossGrams: grams,
  massEvidence: reference,
});
const input = z.strictObject({
  facility: reference,
  methodVersion: reference,
  calculationVersion: reference,
  claimRightsReference: reference,
  start: z.iso.date(),
  endExclusive: z.iso.date(),
  batches: z.array(batch).min(1).max(1000),
  allocationsAlreadyClaimed: z.array(reference).max(10_000),
  baseline: reading,
  project: reading,
  leakage: reading,
});

/** Check one period using measured records and independently prepared inputs. */
export function monitoringPreflight(source) {
  const data = input.parse(source);
  const problems = new Set();
  if (data.start >= data.endExclusive) problems.add("INVALID_PERIOD");

  const allocations = new Set(data.allocationsAlreadyClaimed);
  const batches = new Set();
  let eligibleOutputGrams = 0n;
  for (const row of data.batches) {
    if (batches.has(row.id)) problems.add("REPEATED_BATCH");
    batches.add(row.id);
    if (row.recordedOn < data.start || row.recordedOn >= data.endExclusive) {
      problems.add("BATCH_OUTSIDE_PERIOD");
    }
    const accountedGrams =
      BigInt(row.eligibleOutputGrams) +
      BigInt(row.otherOutputGrams) +
      BigInt(row.rejectsGrams) +
      BigInt(row.lossGrams);
    if (BigInt(row.inputGrams) !== accountedGrams)
      problems.add("MASS_MISMATCH");
    eligibleOutputGrams += BigInt(row.eligibleOutputGrams);
    for (const allocation of row.sourceAllocations) {
      if (allocations.has(allocation)) problems.add("OVERLAPPING_ALLOCATION");
      allocations.add(allocation);
    }
  }
  if (eligibleOutputGrams === 0n) problems.add("NO_ELIGIBLE_OUTPUT");
  if (problems.size > 0) return { status: "hold", problems: [...problems] };
  const netGramsCO2e =
    BigInt(data.baseline.gramsCO2e) -
    BigInt(data.project.gramsCO2e) -
    BigInt(data.leakage.gramsCO2e);
  return {
    status: "preflight_only_unverified",
    facility: data.facility,
    methodVersion: data.methodVersion,
    calculationVersion: data.calculationVersion,
    eligibleOutputGrams: String(eligibleOutputGrams),
    netGramsCO2e: String(netGramsCO2e),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const file = process.argv[2];
    if (!file || process.argv.length !== 3)
      throw new Error("Expected one input file.");
    const result = monitoringPreflight(JSON.parse(readFileSync(file, "utf8")));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status === "hold") process.exitCode = 1;
  } catch {
    process.stderr.write("Could not read or validate the monitoring record.\n");
    process.exitCode = 2;
  }
}
