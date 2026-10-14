/** A phone quota survives browser sessions and IP changes. */
export const SMS_COOLDOWN_MS = 5 * 60_000;
export const SMS_DAY_MS = 24 * 60 * 60_000;
export const SMS_DAY_LIMIT = 5;

export function smsAllowance(sentAt: readonly number[], now: number) {
  const ordered = sentAt.toSorted((a, b) => a - b);
  const last = ordered.at(-1);
  // Retain all five timestamps until a full day after the final send.
  // Filtering each timestamp first would release the lock too early.
  const isLocked =
    ordered.length >= SMS_DAY_LIMIT &&
    last !== undefined &&
    last + SMS_DAY_MS > now;
  const recent = isLocked
    ? ordered
    : ordered.filter((at) => at > now - SMS_DAY_MS);
  const delay = isLocked ? SMS_DAY_MS : SMS_COOLDOWN_MS;
  const retryAt = Math.max(now, last === undefined ? now : last + delay);
  return {
    allowed: retryAt <= now,
    retryAfterSeconds: Math.ceil((retryAt - now) / 1000),
    recent,
  };
}

/** Use a keyed digest: a plain hash of a mobile number is easy to enumerate. */
export async function smsPhoneHash(
  phone: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`sms:${phone}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
