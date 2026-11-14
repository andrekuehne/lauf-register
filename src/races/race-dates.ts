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
