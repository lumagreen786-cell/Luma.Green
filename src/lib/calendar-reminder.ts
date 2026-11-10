function calendarText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(/\r\n|\r|\n/g, String.raw`\n`)
    .replaceAll(",", String.raw`\,`)
    .replaceAll(";", String.raw`\;`);
}

function fold(line: string) {
  const encoder = new TextEncoder();
  let bytes = 0;
  let result = "";
  for (const character of line) {
    const width = encoder.encode(character).length;
    if (bytes + width > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += width;
  }
  return result;
}

export function dailyCalendarReminder(
  time: string,
  title: string,
  description: string,
  now: Date,
  id: string,
) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match || !/^[a-z0-9-]+$/i.test(id)) return null;
  const start = new Date(now);
  start.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  const day = [start.getFullYear(), start.getMonth() + 1, start.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("");
  const stamp = now.toISOString().replaceAll(/-|:|\.\d{3}/g, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Luma.Green//Household Reminder//EN",
    "BEGIN:VEVENT",
    `UID:${id}@luma.green`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${day}T${match[1]}${match[2]}00`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:${calendarText(title)}`,
    `DESCRIPTION:${calendarText(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${calendarText(description)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map((line) => fold(line))
    .join("\r\n");
}
