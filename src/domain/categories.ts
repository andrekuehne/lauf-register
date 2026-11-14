// The fixed sets of Divisions, Durations, Genders and Titles (see GLOSSARY.md).
// Shared by the Worker and the browser bundle: keep it free of runtime APIs.

export const DURATIONS = [30, 60] as const;
export type Duration = (typeof DURATIONS)[number];

export const GENDERS = ["F", "M"] as const;
export type Gender = (typeof GENDERS)[number];

export const TITLES = ["none", "dr"] as const;
export type Title = (typeof TITLES)[number];

/** The second choice in the flow: one Participant or a Pair. */
export const SINGLE_OR_PAIR = ["single", "pair"] as const;
export type SingleOrPair = (typeof SINGLE_OR_PAIR)[number];

export const DIVISIONS = ["women", "men", "womens_pair", "mens_pair", "mixed_pair"] as const;
export type Division = (typeof DIVISIONS)[number];

/** The Divisions offered after choosing single or pair, in display order. */
export const DIVISIONS_FOR: Record<SingleOrPair, readonly Division[]> = {
  single: ["women", "men"],
  pair: ["womens_pair", "mens_pair", "mixed_pair"],
};

export function singleOrPairOf(division: Division): SingleOrPair {
  return DIVISIONS_FOR.single.indexOf(division) >= 0 ? "single" : "pair";
}

function oppositeGender(gender: Gender): Gender {
  return gender === "F" ? "M" : "F";
}

/**
 * The Gender of each slot, in slot order. Fixed by the Division, except in a
 * Mixed pair: there the first person chooses, and the second is the opposite
 * (both unknown until the first has chosen).
 */
export function slotGenders(division: Division, mixedFirstGender?: Gender): (Gender | undefined)[] {
  switch (division) {
    case "women":
      return ["F"];
    case "men":
      return ["M"];
    case "womens_pair":
      return ["F", "F"];
    case "mens_pair":
      return ["M", "M"];
    case "mixed_pair":
      return mixedFirstGender ? [mixedFirstGender, oppositeGender(mixedFirstGender)] : [undefined, undefined];
  }
}

/** The Division of a stored Registration: it follows from its Participants' Genders. */
export function divisionOf(genders: readonly Gender[]): Division {
  if (genders.length === 1) return genders[0] === "F" ? "women" : "men";
  if (genders[0] !== genders[1]) return "mixed_pair";
  return genders[0] === "F" ? "womens_pair" : "mens_pair";
}

function isOneOf<T>(list: readonly T[], value: unknown): value is T {
  return (list as readonly unknown[]).indexOf(value) >= 0;
}

export const isDivision = (value: unknown): value is Division => isOneOf(DIVISIONS, value);
export const isDuration = (value: unknown): value is Duration => isOneOf(DURATIONS, value);
export const isGender = (value: unknown): value is Gender => isOneOf(GENDERS, value);
export const isTitle = (value: unknown): value is Title => isOneOf(TITLES, value);
export const isSingleOrPair = (value: unknown): value is SingleOrPair => isOneOf(SINGLE_OR_PAIR, value);
