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

/** The organizers' time zone: registration times are shown in it. */
const RACE_TIME_ZONE = "Europe/Berlin";

/**
 * When a Registration came in: "14:32" on the race day, "08.12. 21:05" on any
 * other day (registration can open before the day).
 */
export function formatRegistrationTime(createdAt: string, raceDate: string): string {
  const parts = new Intl.DateTimeFormat("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: RACE_TIME_ZONE,
  }).formatToParts(new Date(createdAt));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const time = `${part("hour")}:${part("minute")}`;
  const sameDay = `${part("year")}-${part("month")}-${part("day")}` === raceDate;
  return sameDay ? time : `${part("day")}.${part("month")}. ${time}`;
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
