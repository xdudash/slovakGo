/** One learning day for the browser and API, independent of the server's timezone. */
export const LEARNING_TIME_ZONE = "Europe/Bratislava";
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LEARNING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function learningDay(now = new Date()): string {
  const parts = dayFormatter.formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function shiftLearningDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function learningWeek(now = new Date()): string {
  const day = learningDay(now);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
  return shiftLearningDay(day, 1 - weekday);
}
