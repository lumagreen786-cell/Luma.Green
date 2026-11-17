import { GRID_GRAMS_CO2_PER_KWH } from "../../src/lib/household-footprint";

/** A bounded manual estimate; no provider bill or issued credit is inferred. */
export function electricityLogInput(
  input: {
    wattHours: number;
    periodStart: string;
    periodEnd: string;
  },
  today: string,
) {
  const isValidDay = (day: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
  if (
    !isValidDay(input.periodStart) ||
    !isValidDay(input.periodEnd) ||
    input.periodStart > input.periodEnd ||
    input.periodEnd > today ||
    input.periodStart < "2000-01-01" ||
    Date.parse(input.periodEnd) - Date.parse(input.periodStart) >
      366 * 86_400_000 ||
    !Number.isSafeInteger(input.wattHours) ||
    input.wattHours < 0 ||
    input.wattHours > 1_000_000_000
  )
    return null;
  const milliGramsCO2 = input.wattHours * GRID_GRAMS_CO2_PER_KWH;
  return Number.isSafeInteger(milliGramsCO2) ? milliGramsCO2 : null;
}
