// The search on a Race's admin page: what it finds a Registration by, as the
// server writes it on each Registration's card (src/admin/registrations-page.tsx)
// and the browser reads it back (src/client/race-search.ts).

import { normalizedText } from "./same-text";

/** The id of the search field. */
export const SEARCH_FIELD_ID = "reg-search";

/** The attributes of a Registration's card that hold its SearchKeys. */
export const SEARCH_ATTRIBUTES = { numbers: "data-numbers", names: "data-names" } as const;

/**
 * What the search finds a Registration by: its number and its Previous numbers
 * (space-separated), and each Participant's name as typed text compares (one per
 * line, so a search never spans two Participants).
 */
export type SearchKeys = { numbers: string; names: string };

/** The SearchKeys of a Registration with these numbers and Participants. */
export function searchKeys(numbers: readonly number[], participants: readonly { firstName: string; lastName: string }[]): SearchKeys {
  return {
    numbers: numbers.join(" "),
    names: participants.map((p) => normalizedText(`${p.firstName} ${p.lastName}`)).join("\n"),
  };
}

/**
 * Whether what was typed finds the Registration: a number when it is the
 * Registration's number or a Previous number; anything else when it is part of
 * a Participant's name, case and spacing aside (as for Possible duplicates).
 * An empty search finds every Registration.
 */
export function matchesSearch(keys: SearchKeys, typed: string): boolean {
  const query = normalizedText(typed);
  if (query === "") return true;
  if (/^\d+$/.test(query)) return keys.numbers.split(" ").map(Number).indexOf(Number(query)) >= 0;
  return keys.names.indexOf(query) >= 0;
}
