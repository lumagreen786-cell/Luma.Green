import { describe, expect, it } from "vitest";

import { gridElectricityFootprint } from "./household-footprint";

describe("household electricity footprint", () => {
  it("uses the published India grid average and accepts localized measurements", () => {
    expect(gridElectricityFootprint("١٠٫٥", "ar")).toBeCloseTo(7.0875, 8);
    expect(gridElectricityFootprint("100", "en")).toBe(67.5);
    expect(gridElectricityFootprint("0", "en")).toBe(0);
  });

  it.each(["", "-1", "not measured", "Infinity", "0.0001"])(
    "does not invent a result from %j",
    (reading) => {
      expect(gridElectricityFootprint(reading, "en")).toBeNull();
    },
  );
});
