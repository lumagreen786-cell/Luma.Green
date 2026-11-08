import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { z } from "zod";

const ref = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9._:/-]+$/u);
const serial = z.string().regex(/^(?:0|[1-9]\d{0,29})$/u);
const paise = z.number().int().nonnegative();
const lot = z.strictObject({
  registry: ref,
  project: ref,
  vintage: z.number().int().min(1900).max(9999),
  serialSeries: ref,
  firstSerial: serial,
  lastSerial: serial,
  units: z.number().int().positive(),
});
const expected = lot.extend({
  seller: ref,
  buyer: ref,
  order: ref,
  beneficiary: z.string().trim().min(1).max(160),
  totalPaise: paise,
});
const receipt = z.strictObject({ event: ref, account: ref, lot });
const input = z.strictObject({
  expected,
  issuance: receipt,
  transfer: receipt.extend({ recipient: ref, order: ref }),
  retirement: receipt.extend({ beneficiary: expected.shape.beneficiary }),
  settlement: z.strictObject({
    event: ref,
    order: ref,
    payer: ref,
    payee: ref,
    currency: z.literal("INR"),
    totalPaise: paise,
  }),
});

function sameLot(a, b) {
  return Object.keys(lot.shape).every((key) => a[key] === b[key]);
}

/** Compare supplied records for one full-lot pilot sale. No provider calls. */
export function reconcilePilot(source) {
  const data = input.parse(source);
  const { expected: plan, issuance, transfer, retirement, settlement } = data;
  const problems = [];
  if (
    BigInt(plan.lastSerial) - BigInt(plan.firstSerial) + 1n !==
    BigInt(plan.units)
  ) {
    problems.push("SERIAL_COUNT_MISMATCH");
  }
  if (plan.seller === plan.buyer || plan.totalPaise === 0) {
    problems.push("INVALID_SALE");
  }
  if (new Set([issuance.event, transfer.event, retirement.event]).size !== 3) {
    problems.push("REPEATED_REGISTRY_EVENT");
  }
  if (!sameLot(plan, issuance.lot) || issuance.account !== plan.seller) {
    problems.push("ISSUANCE_MISMATCH");
  }
  if (
    !sameLot(plan, transfer.lot) ||
    transfer.account !== plan.seller ||
    transfer.recipient !== plan.buyer ||
    transfer.order !== plan.order
  ) {
    problems.push("TRANSFER_MISMATCH");
  }
  if (
    settlement.order !== plan.order ||
    settlement.payer !== plan.buyer ||
    settlement.payee !== plan.seller ||
    settlement.totalPaise !== plan.totalPaise
  ) {
    problems.push("SETTLEMENT_MISMATCH");
  }
  if (
    !sameLot(plan, retirement.lot) ||
    retirement.account !== plan.buyer ||
    retirement.beneficiary !== plan.beneficiary
  ) {
    problems.push("RETIREMENT_MISMATCH");
  }
  return {
    status: problems.length === 0 ? "records_match_unverified" : "hold",
    problems,
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
    const result = reconcilePilot(JSON.parse(readFileSync(file, "utf8")));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status === "hold") process.exitCode = 1;
  } catch {
    process.stderr.write("Could not read or validate the pilot record.\n");
    process.exitCode = 2;
  }
}
