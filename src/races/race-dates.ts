import type { Lang } from "../i18n";

const locale = (lang: Lang) => (lang === "de" ? "de-DE" : "en-GB");
const atUtcMidnight = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

/** The calendar year of a Race's date; ages are computed for it. */
export function raceYear(race: { date: string }): number {
  return Number(race.date.slice(0, 4));
}

/** "Mittwoch, 9. Dezember 2026" */
export function formatRaceDateLong(isoDate: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(atUtcMidnight(isoDate));
}

/** The organizers' time zone: registration times are shown in it, and days are counted in it. */
const RACE_TIME_ZONE = "Europe/Berlin";

/** Calendar date and clock time of an instant in the organizers' time zone. */
function inRaceTimeZone(instant: Date) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: RACE_TIME_ZONE,
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day"), time: `${part("hour")}:${part("minute")}` };
}

/** The ISO date (YYYY-MM-DD) it is at `instant` in the organizers' time zone. */
export function dateInRaceTimeZone(instant: Date): string {
  const { year, month, day } = inRaceTimeZone(instant);
  return `${year}-${month}-${day}`;
}

/** The ISO date `days` calendar days before `isoDate`. */
export function daysBefore(isoDate: string, days: number): string {
  const date = atUtcMidnight(isoDate);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * When a Registration came in: "14:32" on the race day, "08.12. 21:05" on any
 * other day (registration can open before the day).
 */
export function formatRegistrationTime(createdAt: string, raceDate: string): string {
  const instant = new Date(createdAt);
  const at = inRaceTimeZone(instant);
  return dateInRaceTimeZone(instant) === raceDate ? at.time : `${at.day}.${at.month}. ${at.time}`;
}

/** "Mi., 09.12.2026" */
export function formatRaceDateShort(isoDate: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(atUtcMidnight(isoDate));
}
