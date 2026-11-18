import { describe, expect, it } from "vitest";

import {
  getParticipantActivationPolicy,
  isParticipantType,
  PARTICIPANT_ACTIVATION_POLICIES,
  PARTICIPANT_GROUPS,
  PARTICIPANT_TYPES,
} from "./participantTypes";

describe("participant activation policy", () => {
  it("accounts for every supported type without adding authorization roles", () => {
    expect(PARTICIPANT_TYPES).toHaveLength(41);
    expect(new Set(Object.keys(PARTICIPANT_ACTIVATION_POLICIES))).toEqual(
      new Set(PARTICIPANT_TYPES),
    );
    expect(isParticipantType("owner")).toBe(false);
    expect(isParticipantType("admin")).toBe(false);
    expect(isParticipantType("unknown_industry")).toBe(false);
  });

  it.each([
    ["kabadiwala", "kabadiwala"],
    ["saathi", "saathi"],
    ["large_yard", "yard"],
    ["preprocessor", "yard"],
    ["recycler", "recycler"],
    ["intermediary_manufacturer", "manufacturer"],
    ["end_goods_manufacturer", "manufacturer"],
  ] as const)("continues %s through verified %s onboarding", (type, kind) => {
    expect(getParticipantActivationPolicy(type)).toEqual({
      kind: "verified_application",
      applicationKind: kind,
    });
  });

  it("keeps households and generators separate from business activation", () => {
    expect(getParticipantActivationPolicy("household")).toEqual({
      kind: "household",
    });
    for (const type of [
      "small_business",
      "industrial_seller",
      "institution",
    ] as const)
      expect(getParticipantActivationPolicy(type)).toEqual({
        kind: "generator",
      });
  });

  it("requires invitations for every partner, civic, auditor and staff type", () => {
    expect(PARTICIPANT_GROUPS.partners).toHaveLength(11);
    for (const type of PARTICIPANT_GROUPS.partners)
      expect(getParticipantActivationPolicy(type)).toEqual({
        kind: "invitation_required",
      });
  });

  it("requires actual capability review without impersonating another business", () => {
    for (const type of [
      "trader",
      "dry_waste_centre",
      "collection_contractor",
      "rural_collector",
      "e_waste_operator",
      "wet_waste_processor",
      "epr_brand",
      "pro",
      ...PARTICIPANT_GROUPS.services,
    ] as const)
      expect(getParticipantActivationPolicy(type)).toEqual({
        kind: "capability_review",
      });
  });

  it.each(["epr_trading", "carbon_trading"] as const)(
    "keeps %s execution pending external acceptance",
    (type) => {
      expect(getParticipantActivationPolicy(type)).toEqual({
        kind: "provider_pending",
      });
    },
  );
});
