import { v } from "convex/values";
import { z } from "zod";

export const vNotificationEvent = v.union(
  v.literal("booking_confirmed"),
  v.literal("booking_offer"),
  v.literal("booking_accepted"),
  v.literal("booking_reassigned"),
  v.literal("application_received"),
  v.literal("application_approved"),
  v.literal("application_changes_requested"),
  v.literal("application_rejected"),
);
export type NotificationEvent = typeof vNotificationEvent.type;
/** Collaboration has no SMS template; keep it out of the notification outbox. */
export const vInboxEvent = v.union(
  vNotificationEvent,
  v.literal("collaboration_updated"),
);
export type InboxEvent = typeof vInboxEvent.type;
export const vNotificationStatus = v.union(
  v.literal("pending"),
  v.literal("sending"),
  v.literal("disabled"),
  v.literal("cancelled"),
  v.literal("rate_limited"),
  v.literal("provider_accepted"),
  v.literal("failed"),
  v.literal("unknown"),
);
const templatesSchema = z.record(
  z.string(),
  z.record(z.string(), z.string().trim().min(1).max(100)),
);

/** Configuration errors disable this channel; they must not reject a booking. */
export function notificationConfig(event: NotificationEvent, locale: string) {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  const raw = process.env.MSG91_NOTIFICATION_TEMPLATES;
  const site = process.env.SMS_NOTIFICATION_BASE_URL;
  if (!authKey || !raw || !site) return null;
  try {
    const base = new URL(site);
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    )
      return null;
    const parsed = templatesSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const templates = new Map(Object.entries(parsed.data)).get(event);
    if (!templates) return null;
    const localized = new Map(Object.entries(templates));
    const selectedLocale =
      !localized.has(locale) &&
      process.env.MSG91_NOTIFICATION_ENGLISH_FALLBACK === "true"
        ? "en"
        : locale;
    const templateId = localized.get(selectedLocale);
    return templateId
      ? { authKey, templateId, locale: selectedLocale, origin: base.origin }
      : null;
  } catch {
    return null;
  }
}

/** Provider acceptance does not prove delivery. Never retry ambiguous results. */
export async function sendNotification(input: {
  authKey: string;
  templateId: string;
  phone: string;
  link: string;
}): Promise<"provider_accepted" | "failed" | "unknown"> {
  try {
    const response = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: {
        authkey: input.authKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        template_id: input.templateId,
        short_url: "0",
        recipients: [{ mobiles: input.phone.slice(1), VAR1: input.link }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    // A server or proxy error can follow a successful provider side effect.
    if (!response.ok) return response.status >= 500 ? "unknown" : "failed";
    const result: unknown = await response.json();
    if (result && typeof result === "object" && "type" in result) {
      if (result.type === "success") return "provider_accepted";
      if (result.type === "error") return "failed";
    }
    return "unknown";
  } catch {
    // Includes timeout, transport failure and an unreadable success payload.
    // Do not store provider text: it can contain phone numbers or credentials.
    return "unknown";
  }
}
