export const reportingTimezone = 'Asia/Kolkata';
const offset = 330 * 60_000;
const day = 86_400_000;
// Store UTC instants; report today plus the preceding N-1 India calendar days.
export function reportingWindow(days: number, now = Date.now()) {
  if (![7, 14, 30].includes(days)) throw new Error('Invalid reporting window');
  const midnight = Math.floor((now + offset) / day) * day - offset;
  return {
    start: new Date(midnight - (days - 1) * day).toISOString(),
    end: new Date(now).toISOString(),
    timezone: reportingTimezone,
  };
}
