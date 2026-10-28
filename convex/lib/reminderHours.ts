/** Non-urgent notices may run only from 08:00 inclusive to 20:00 exclusive IST. */
export function nextReminderTime(now: number): number {
  const offset = 330 * 60_000;
  const india = new Date(now + offset);
  const hour = india.getUTCHours();
  if (hour >= 8 && hour < 20) return now;
  const next = Date.UTC(
    india.getUTCFullYear(),
    india.getUTCMonth(),
    india.getUTCDate() + (hour >= 20 ? 1 : 0),
    8,
  );
  return next - offset;
}
