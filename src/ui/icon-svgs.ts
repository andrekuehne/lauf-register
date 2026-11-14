import { slotGenders, type Division } from "../domain/categories";

// Inline SVG icons (24×24, fill currentColor). Plain strings, shared by the
// server-rendered pages and the browser bundle.

const person =
  '<circle cx="12" cy="6" r="3.5"/><path d="M12 11c-3.6 0-6.5 2.4-6.5 5.5V21h13v-4.5C18.5 13.4 15.6 11 12 11z"/>';
const pair =
  '<circle cx="8" cy="7" r="3"/><circle cx="16.5" cy="7" r="3"/><path d="M8 11.3c-3 0-5.5 2-5.5 4.7V20h11v-4c0-2.7-2.5-4.7-5.5-4.7zM16.5 11.3c-1 0-1.9.2-2.7.6 1.2 1 1.9 2.4 1.9 4.1v4h6.8v-4c0-2.7-2.6-4.7-6-4.7z"/>';
const stopwatch =
  '<path d="M9 1h6v2H9zM19 7.4l1.4-1.4-1.4-1.4-1.5 1.5A9 9 0 1 0 19 7.4zM12 21a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm1-11h-2v5l4 2.4.9-1.6-2.9-1.8z"/>';

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  single: svg(person),
  pair: svg(pair),
  duration: svg(stopwatch),
};

export function divisionIconSvg(division: Division): string {
  return slotGenders(division).length === 1 ? ICONS.single : ICONS.pair;
}
