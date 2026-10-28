/** Official state/UT reference names, not GST codes or a facility authorization. */
export const INDIA_STATES_AND_UTS = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

function cleanText(value: string) {
  return value.normalize("NFC").trim().replaceAll(/\s+/g, " ");
}

export function canonicalCityName(value: string): string | null {
  const clean = cleanText(value);
  return clean.length < 2 ||
    clean.length > 60 ||
    !/\p{L}/u.test(clean) ||
    !/^[\p{L}\p{M} .’'\-]+$/u.test(clean)
    ? null
    : clean
        .toLowerCase()
        .replaceAll(
          /(^|[ -])(\p{L})/gu,
          (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
        );
}

/** Parse draft input without inferring a state from an address, GST or GPS. */
export function localityParts(value: string): { city: string; state: string } {
  const parts = value.split(",");
  const city = parts[0] ?? "";
  if (parts.length === 1 && canonicalCityName(city) === "Bengaluru")
    return { city, state: "Karnataka" };
  const suffix = cleanText(parts.slice(1).join(",")).toLowerCase();
  const state =
    INDIA_STATES_AND_UTS.find((name) => name.toLowerCase() === suffix) ?? "";
  return { city, state };
}

/** The sole legacy partition is Bengaluru in Karnataka. Existing rows are untouched. */
export function canonicalCity(value: string | undefined): string | null {
  if (value === undefined || value.split(",").length > 2) return null;
  const { city, state } = localityParts(value);
  const name = canonicalCityName(city);
  if (!name || !state) return null;
  return name === "Bengaluru" && state === "Karnataka"
    ? "Bengaluru"
    : `${name}, ${state}`;
}
