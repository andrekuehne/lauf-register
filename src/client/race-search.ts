// The search on a Race's admin page (src/admin/registrations-page.tsx): as the
// Race desk types, the list shows only the Registrations it finds (see
// src/shared/registration-search.ts), and Division and Duration groups left
// empty hide. Bundled by scripts/build-client.mjs for ~iOS 12 / Android 8
// browsers and inlined into the Race page.

import { matchesSearch, SEARCH_ATTRIBUTES, SEARCH_FIELD_ID } from "../shared/registration-search";

const REGISTRATION = "li[data-registration]";

/** The elements matching the selector, as an array (NodeList.forEach is missing on some older phones). */
const all = (selector: string) => Array.prototype.slice.call(document.querySelectorAll(selector)) as HTMLElement[];

const field = document.getElementById(SEARCH_FIELD_ID) as HTMLInputElement | null;
const searchBox = field && (field.closest(".reg-search") as HTMLElement | null);

if (field && searchBox) {
  const cards = all(REGISTRATION);
  const groups = all(".reg-division, .reg-duration");
  const noMatch = searchBox.querySelector(".reg-none") as HTMLElement;

  const applySearch = () => {
    let found = 0;
    for (const card of cards) {
      const keys = { numbers: card.getAttribute(SEARCH_ATTRIBUTES.numbers) || "", names: card.getAttribute(SEARCH_ATTRIBUTES.names) || "" };
      card.hidden = !matchesSearch(keys, field.value);
      if (!card.hidden) found++;
    }
    for (const group of groups) group.hidden = !group.querySelector(`${REGISTRATION}:not([hidden])`);
    noMatch.hidden = found > 0;
  };

  searchBox.hidden = false;
  field.addEventListener("input", applySearch);
  // Coming back to the page, the browser may have kept what was typed.
  window.addEventListener("pageshow", applySearch);
  applySearch();
}
