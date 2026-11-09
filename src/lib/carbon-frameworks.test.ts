import { describe, expect, it } from "vitest";

import {
  carbonFrameworkIds,
  carbonFrameworks,
  carbonGateIds,
  carbonGatesForProject,
  carbonIndustries,
  carbonIndustryIds,
} from "./carbon-frameworks";

describe("carbon framework screening catalogue", () => {
  it.each(carbonFrameworkIds)("uses unique, supported gates for %s", (id) => {
    const { gates, source, lifecycleSource } = carbonFrameworks[id];
    expect(gates).toContain("method_and_version");
    expect(new Set(gates).size).toBe(gates.length);
    expect(carbonGateIds).toEqual(expect.arrayContaining([...gates]));
    expect(new URL(source).protocol).toBe("https:");
    expect(new URL(lifecycleSource).protocol).toBe("https:");
  });

  it("separates accounting from credit issuance and retirement", () => {
    const accounting = carbonFrameworks.ghg_protocol;
    expect(accounting.kind).toBe("accounting");
    expect(accounting.gates).toContain("inventory_boundary_and_scopes");
    expect(accounting.gates).not.toContain("issuance");
    expect(accounting.gates).not.toContain("retirement");
    expect(accounting.gates).not.toContain("transfer_and_settlement");
  });

  it.each(carbonIndustryIds)(
    "adds activity evidence only to the candidate framework for %s",
    (id) => {
      const { framework, gates } = carbonIndustries[id];
      const projectGates = carbonGatesForProject(framework, id);
      expect(projectGates).toEqual(expect.arrayContaining([...gates]));
      expect(new Set(projectGates).size).toBe(projectGates.length);
      expect(carbonGateIds).toEqual(expect.arrayContaining([...gates]));
      expect(carbonGatesForProject("ghg_protocol", id)).toEqual(
        carbonFrameworks.ghg_protocol.gates,
      );
    },
  );

  it.each(["acr", "car"] as const)(
    "lists verification before registration for %s",
    (id) => {
      const { gates } = carbonFrameworks[id];
      expect(gates.indexOf("verification")).toBeLessThan(
        gates.indexOf("registration"),
      );
    },
  );

  it("keeps the PET method candidate subject to collection and displacement checks", () => {
    expect(carbonFrameworks.verra.petFit).toBe("candidate");
    expect(carbonGatesForProject("verra", "pet_plastics")).toEqual(
      expect.arrayContaining([
        "collection_scope",
        "dry_mass_and_pet_grade",
        "buyer_end_use",
        "virgin_material_displacement",
      ]),
    );
    expect(carbonFrameworks.gold_standard.petFit).toBe("unconfirmed");
    expect(carbonFrameworks.ccts.petFit).toBe("no_listed_method");
    expect(carbonFrameworks.puro.petFit).toBe("out_of_scope");
  });
});
