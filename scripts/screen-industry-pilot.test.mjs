import assert from "node:assert/strict";
import { test } from "node:test";

import { screenIndustryPilot } from "./screen-industry-pilot.mjs";

function fixture(route = "dry_recycling") {
  return {
    intake: {
      schemaVersion: 1,
      route,
      facility: {
        operator: "Fixture operator",
        site: "Fixture site",
        state: "Karnataka",
        district: "Bengaluru Urban",
        serviceCity: "Bengaluru",
      },
      processLine: "Fixture line",
      systems: [],
      equipment: [],
      wasteStreams: [
        { name: "Feed", direction: "input" },
        { name: "Output", direction: "output" },
      ],
    },
    batch: {
      reference: "WEIGH-1",
      outputStream: "Output",
      inputGrams: 10_000,
      outputGrams: 8000,
      lossGrams: 2000,
    },
    quotes: [
      {
        buyer: "Ineligible",
        stream: "Output",
        permission: "unreviewed",
        minimumGrams: 1000,
        maximumGrams: 10_000,
        quotedPaise: 2000,
        freightPaise: 100,
        handlingPaise: 100,
      },
      {
        buyer: "Fit",
        stream: "Output",
        permission: "reviewed",
        permissionReference: "FIXTURE-PERMIT",
        minimumGrams: 1000,
        maximumGrams: 10_000,
        quotedPaise: 1000,
        freightPaise: 200,
        handlingPaise: 100,
      },
    ],
    climate: {
      inventoryBoundary: "Fixture operator controlled sites",
      period: "2026",
      inventory: [
        { scope: "scope_1", kgCo2e: 100, source: "Fuel fixture" },
        { scope: "scope_2_location", kgCo2e: 200, source: "Meter fixture" },
        { scope: "scope_2_market", kgCo2e: 80, source: "Contract fixture" },
        { scope: "scope_3", category: 5, kgCo2e: 50, source: "Waste fixture" },
      ],
      projectEstimateKgCo2e: 500,
    },
  };
}

for (const route of ["dry_recycling", "compressed_biogas"]) {
  test(`previews ${route} through intake, buyer screening and accounting`, () => {
    const report = screenIndustryPilot(fixture(route));
    assert.equal(report.route, route);
    assert.deepEqual(report.quotes, [{ buyer: "Fit", netQuotePaise: 700 }]);
    assert.deepEqual(report.inventory, {
      scope_1: 100,
      scope_2_location: 200,
      scope_2_market: 80,
      scope_3: 50,
    });
    assert.equal(report.projectEstimateKgCo2e, 500);
    assert.equal(report.baseCreditRevenuePaise, 0);
  });
}

test("rejects inconsistent mass, unknown streams and a reviewed quote with no reference", () => {
  const input = fixture();
  assert.throws(
    () =>
      screenIndustryPilot({
        ...input,
        batch: { ...input.batch, lossGrams: 1 },
      }),
    /MASS_BALANCE/,
  );
  assert.throws(
    () =>
      screenIndustryPilot({
        ...input,
        batch: { ...input.batch, outputStream: "Other" },
      }),
    /OUTPUT_STREAM/,
  );
  input.quotes[1].permissionReference = undefined;
  assert.deepEqual(screenIndustryPilot(input).quotes, []);
});

test("keeps absent inventory scopes unknown and rejects invalid Scope 3 categories", () => {
  const input = fixture();
  input.climate.inventory = [input.climate.inventory[0]];
  assert.equal(screenIndustryPilot(input).inventory.scope_3, null);
  assert.equal(screenIndustryPilot(input).inventory.scope_2_market, null);
  input.climate.inventory = [
    { scope: "scope_3", category: 16, kgCo2e: 1, source: "Test" },
  ];
  assert.throws(() => screenIndustryPilot(input));
});

test("rejects quotes outside capacity and reports negative net proceeds", () => {
  const input = fixture();
  input.quotes[1].maximumGrams = 7000;
  assert.deepEqual(screenIndustryPilot(input).quotes, []);
  input.quotes[1].maximumGrams = 10_000;
  input.quotes[1].freightPaise = 1100;
  assert.deepEqual(screenIndustryPilot(input).quotes, [
    { buyer: "Fit", netQuotePaise: -200 },
  ]);
});

test("rejects unsafe inventory totals", () => {
  const input = fixture();
  input.climate.inventory = [
    { scope: "scope_1", kgCo2e: Number.MAX_SAFE_INTEGER, source: "Fixture 1" },
    { scope: "scope_1", kgCo2e: 1, source: "Fixture 2" },
  ];
  assert.throws(() => screenIndustryPilot(input), /UNSAFE_TOTAL/);
});
