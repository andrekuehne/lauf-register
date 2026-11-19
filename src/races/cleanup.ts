// The daily cleanup: personal data doesn't outlive the Race. The privacy notice
// (src/privacy/privacy-page.tsx) promises deletion no later than 30 days after
// the race, so a Race goes on the 30th day after its date, counted in the
// organizers' time zone. D1's backups keep it 7 more days, as the notice says.

import { dateInRaceTimeZone, daysBefore } from "./race-dates";
import { deleteRacesDatedUpTo } from "./races";

const RETENTION_DAYS = 30;

/** Deletes every Race whose date is RETENTION_DAYS or more days before `now`'s date; returns how many. */
export async function deleteExpiredRaces(db: D1Database, now: Date): Promise<number> {
  return deleteRacesDatedUpTo(db, daysBefore(dateInRaceTimeZone(now), RETENTION_DAYS));
}
