/**
 * Phone numbers for the pilot: Indian mobiles only, stored as E.164
 * (`+919876543210`). Pure functions — shared by Convex and the browser.
 */

const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

/** Placeholder email domain for phone-only accounts. Never sent to. */
export const PHONE_EMAIL_DOMAIN = "phone.luma.green";

/**
 * Accepts what people actually type — `98765 43210`, `+91 98765-43210`,
 * `09876543210`, `919876543210` — and returns E.164, or null if it isn't an
 * Indian mobile number.
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replaceAll(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  const e164 = `+91${digits}`;
  return INDIAN_MOBILE.test(e164) ? e164 : null;
}

/** A profile cache is not evidence that Better Auth verified this phone. */
export function verifiedIndianMobile(
  phone: string | null | undefined,
  isVerified: boolean | null | undefined,
): string | null {
  return isVerified === true && phone ? normalizeIndianMobile(phone) : null;
}

export function isIndianMobile(e164: string): boolean {
  return INDIAN_MOBILE.test(e164);
}

/** Better Auth needs an email on every user; phone-only users get this one. */
export function phoneEmail(e164: string): string {
  return `${e164.replace("+", "")}@${PHONE_EMAIL_DOMAIN}`;
}

/** `+919876543210` → `+91 98765 43210`, for display. */
export function formatIndianMobile(e164: string): string {
  return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
}

/** `+919876543210` → `+91•••••••210`, for logs. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 3)}${"•".repeat(Math.max(0, e164.length - 6))}${e164.slice(-3)}`;
}
