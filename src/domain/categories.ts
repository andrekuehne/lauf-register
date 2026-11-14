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

export function isDivision(value: unknown): value is Division {
  return (DIVISIONS as readonly unknown[]).includes(value);
}

export function isDuration(value: unknown): value is Duration {
  return (DURATIONS as readonly unknown[]).includes(value);
}

export function isTitle(value: unknown): value is Title {
  return (TITLES as readonly unknown[]).includes(value);
}
