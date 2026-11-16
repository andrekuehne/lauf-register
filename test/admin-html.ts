// Reading the admin pages' HTML the way an Admin reads the screen: one Race's
// card on the start page, and the Registration open/closed toggle.

const decode = (text: string) =>
  text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (attrs: string, name: string) => {
  const value = attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  return value === undefined ? undefined : decode(value);
};

/** The card of the Race with this name on the admin start page, or "" when there is none. */
export function raceCard(html: string, name: string): string {
  return [...html.matchAll(/<li class="card[^"]*">[\s\S]*?<\/li>/g)].map((m) => m[0]).find((card) => textOf(card).startsWith(name)) ?? "";
}

/** The links of a piece of a page: their text and where they go. */
export function links(html: string): { text: string; href: string }[] {
  return [...html.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ text: textOf(m[2]!), href: attr(m[1]!, "href") ?? "" }));
}

/** A piece of a page as plain text, the way it reads on screen. */
export const pageText = textOf;

/** The Reserved number ranges on a Race settings page: their text and the range their remove button removes. */
export function reservedRangesOnPage(html: string): { text: string; from: string | undefined; to: string | undefined; label: string | undefined }[] {
  const list = html.match(/<ul class="reserved-list">([\s\S]*?)<\/ul>/)?.[1] ?? "";
  return [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => {
    const item = m[1]!;
    const input = (name: string) => attr(item.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "", "value");
    return {
      text: textOf(item),
      from: input("from"),
      to: input("to"),
      label: attr(item.match(/<button([^>]*)>/)?.[1] ?? "", "aria-label"),
    };
  });
}

export type Toggle = {
  /** The half shown as the current state. */
  state: string;
  /** The other half: what tapping it sends, and the question asked first. */
  offer: { text: string; open: string | undefined; confirm: string | undefined };
};

/** The Registration open/closed toggle in a piece of a page, or null when there is none. */
export function registrationToggle(html: string): Toggle | null {
  const form = html.match(/<form[^>]*class="reg-switch"[\s\S]*?<\/form>/)?.[0];
  if (!form) return null;
  const halves = [...form.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1]!, text: textOf(m[2]!) }));
  const current = halves.filter((h) => attr(h.attrs, "aria-pressed") === "true");
  const other = halves.filter((h) => attr(h.attrs, "aria-pressed") === "false");
  if (halves.length !== 2 || current.length !== 1 || other.length !== 1) throw new Error(`Unexpected toggle: ${form}`);
  const offer = other[0]!;
  return {
    state: current[0]!.text,
    offer: { text: offer.text, open: attr(offer.attrs, "value"), confirm: attr(offer.attrs, "data-confirm") },
  };
}
