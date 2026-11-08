import assert from "node:assert/strict";

import { test } from "vitest";

import { reconcilePilot } from "./reconcile-pilot.mjs";

function fixture() {
  const lot = {
    registry: "test-registry",
    project: "test-project",
    vintage: 2026,
    serialSeries: "test-series",
    firstSerial: "900719925474099900",
    lastSerial: "900719925474099909",
    units: 10,
  };
  return {
    expected: {
      ...lot,
      seller: "test-seller",
      buyer: "test-buyer",
      order: "test-order",
      beneficiary: "Test buyer",
      totalPaise: 98_001,
    },
    issuance: { event: "test-issued", account: "test-seller", lot: { ...lot } },
    transfer: {
      event: "test-transferred",
      account: "test-seller",
      recipient: "test-buyer",
      order: "test-order",
      lot: { ...lot },
    },
    retirement: {
      event: "test-retired",
      account: "test-buyer",
      beneficiary: "Test buyer",
      lot: { ...lot },
    },
    settlement: {
      event: "test-payment",
      order: "test-order",
      payer: "test-buyer",
      payee: "test-seller",
      currency: "INR",
      totalPaise: 98_001,
    },
  };
}

test("matches a full pilot lot using exact serials and paise", () => {
  assert.deepEqual(reconcilePilot(fixture()), {
    status: "records_match_unverified",
    problems: [],
  });
});

test("holds on repeated events, inconsistent counts, counterparty, serials, payment and beneficiary", () => {
  const records = fixture();
  records.expected.lastSerial = "900719925474099910";
  records.issuance.account = "another-owner";
  records.transfer.event = records.issuance.event;
  records.transfer.recipient = "another-buyer";
  records.settlement.totalPaise -= 1;
  records.retirement.beneficiary = "Another beneficiary";
  assert.deepEqual(reconcilePilot(records), {
    status: "hold",
    problems: [
      "SERIAL_COUNT_MISMATCH",
      "REPEATED_REGISTRY_EVENT",
      "ISSUANCE_MISMATCH",
      "TRANSFER_MISMATCH",
      "SETTLEMENT_MISMATCH",
      "RETIREMENT_MISMATCH",
    ],
  });
});

test("rejects malformed serials and amounts without accepting incomplete records", () => {
  const records = fixture();
  records.issuance.lot.firstSerial = "1e6";
  assert.throws(() => reconcilePilot(records));
  assert.throws(() => reconcilePilot({ expected: records.expected }));
  assert.throws(() =>
    reconcilePilot({
      ...fixture(),
      settlement: { ...fixture().settlement, totalPaise: 3.5 },
    }),
  );
});
