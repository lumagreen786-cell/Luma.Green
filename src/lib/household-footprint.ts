import { fixedDecimalInput } from "./number-input";

/** CEA v22.0, FY 2025–26, Table S. Indian grid, including renewables. */
export const GRID_FACTOR_SOURCE =
  "https://cea.nic.in/api/cdm-report-version/view-pdf/en/82";
const GRID_GRAMS_CO2_PER_KWH = 675;

export function gridElectricityFootprint(reading: string, locale: string) {
  const wattHours = fixedDecimalInput(reading, 3, locale);
  if (wattHours === null) return null;
  const milliGrams = wattHours * GRID_GRAMS_CO2_PER_KWH;
  return Number.isSafeInteger(milliGrams) ? milliGrams / 1_000_000 : null;
}
