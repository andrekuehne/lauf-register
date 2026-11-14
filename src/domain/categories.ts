// The fixed set of Divisions, Durations and Titles (see GLOSSARY.md).
// Shared by the Worker and the browser bundle: keep it free of runtime APIs.

export const DIVISIONS = ["women", "men", "womens_pair", "mens_pair", "mixed_pair"] as const;
export type Division = (typeof DIVISIONS)[number];

export const DURATIONS = [60, 30] as const;
export type Duration = (typeof DURATIONS)[number];

export const TITLES = ["none", "dr", "frau", "herr", "kids"] as const;
export type Title = (typeof TITLES)[number];

export type Gender = "F" | "M";

/** The gender of each slot on a Registration, in slot order. Gender is never entered; it follows from this. */
export function slotGenders(division: Division): Gender[] {
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
      return ["F", "M"];
  }
}

/**
 * The gender of each Participant in the order they were entered. A Mixed pair
 * may be entered in either order: Herr marks the man and Frau the woman. When
 * the Titles don't tell (neither, or both the same), the first entered is the
 * woman, as in the stored slot order.
 */
export function enteredGenders(division: Division, titles: readonly Title[]): Gender[] {
  const genders = slotGenders(division);
  const first = titles[0];
  const second = titles[1];
  const manFirst = (first === "herr" && second !== "herr") || (second === "frau" && first !== "frau");
  return division === "mixed_pair" && manFirst ? [...genders].reverse() : genders;
}

/**
 * The Title preselected in a slot until the Participant picks one: Frau or Herr
 * by the slot's gender. In a Mixed pair the second slot takes the opposite of
 * whatever Frau/Herr the first slot ended up with.
 */
export function defaultTitle(division: Division, slot: number, firstSlotTitle: Title): Title {
  if (division === "mixed_pair" && slot === 1) {
    if (firstSlotTitle === "frau") return "herr";
    if (firstSlotTitle === "herr") return "frau";
  }
  return slotGenders(division)[slot] === "M" ? "herr" : "frau";
}

export function isDivision(value: unknown): value is Division {
  return (DIVISIONS as readonly unknown[]).includes(value);
}

export function isDuration(value: unknown): value is Duration {
  return (DURATIONS as readonly unknown[]).includes(value);
}

export function isTitle(value: unknown): value is Title {
  return (TITLES as readonly unknown[]).includes(value);
}
