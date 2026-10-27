import type { Doc } from "../_generated/dataModel";
import { isSpecialistMaterial } from "./specialistReferences";

/** Sector references and facility declarations never grant commercial eligibility. */
export function isOrdinaryMaterial(
  material: Doc<"materials"> | null | undefined,
): material is Doc<"materials"> {
  return (
    material?.active === true &&
    !isSpecialistMaterial(material) &&
    material.byproductEligibility?.hazardStatus !== "hazardous"
  );
}
