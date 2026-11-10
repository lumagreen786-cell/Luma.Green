import { isLocale } from "../../../src/i18n/locales.ts";

export const HOME_REMINDER_NOTIFICATION = "luma.home-exit";

export function nextReminderState(isArmed: boolean, event: "enter" | "exit") {
  return { armed: event === "enter", notify: event === "exit" && isArmed };
}

export function isHouseholdSettings(raw: string, origin: string) {
  try {
    const url = new URL(raw);
    if (url.origin !== origin) return false;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] && isLocale(parts[0])) parts.shift();
    return parts.length === 2 && parts[0] === "sell" && parts[1] === "settings";
  } catch {
    return false;
  }
}
