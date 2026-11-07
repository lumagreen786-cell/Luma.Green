import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { industryPilotIntake } from "./validate-industry-pilot.mjs";

const fixture = {
  schemaVersion: 1,
  facility: {
    operator: "Example operator",
    site: "Example site",
    state: "Karnataka",
    district: "Bengaluru Urban",
    serviceCity: "Bengaluru",
  },
  processLine: "Example line",
  systems: [{ name: "Example stock book", access: "file_export" }],
  equipment: [{ name: "Example weighbridge", unit: "kg" }],
  wasteStreams: [{ name: "Example input", direction: "input" }],
};

describe("industry pilot intake", () => {
  for (const route of ["dry_recycling", "compressed_biogas"]) {
    it(`accepts a ${route} intake`, () => {
      assert.equal(
        industryPilotIntake.safeParse({ ...fixture, route }).success,
        true,
      );
    });
  }

  it("requires a site and a named material stream", () => {
    assert.equal(
      industryPilotIntake.safeParse({
        ...fixture,
        route: "dry_recycling",
        facility: { ...fixture.facility, serviceCity: " " },
        wasteStreams: [],
      }).success,
      false,
    );
  });

  it("rejects credentials and unrecognized routes", () => {
    assert.equal(
      industryPilotIntake.safeParse({
        ...fixture,
        route: "compressed_biogas",
        systems: [{ ...fixture.systems[0], apiKey: "synthetic-value" }],
      }).success,
      false,
    );
    assert.equal(
      industryPilotIntake.safeParse({ ...fixture, route: "issued" }).success,
      false,
    );
  });
});
