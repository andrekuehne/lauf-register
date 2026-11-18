// The search on a Race's admin page and its Anmeldetisch (src/admin/registrations-page.tsx,
// src/admin/desk-page.tsx): as the Race desk types, the list shows only the
// Registrations it finds (see src/shared/registration-search.ts), and Division
// and Duration groups left empty hide. Esc clears it; a field marked autofocus
// gets the cursor as the page opens. When the Anmeldetisch's live updates change
// the list (src/client/desk-live.ts), it applies to the rows the list has now. Bundled by scripts/build-client.mjs for
// ~iOS 12 / Android 8 browsers and inlined into both pages.

import { LIST_CHANGED_EVENT } from "../shared/desk-update";
import { matchesSearch, SEARCH_ATTRIBUTES, SEARCH_FIELD_ID } from "../shared/registration-search";

const REGISTRATION = "li[data-registration]";

/** The elements matching the selector, as an array (NodeList.forEach is missing on some older phones). */
const all = (selector: string) => Array.prototype.slice.call(document.querySelectorAll(selector)) as HTMLElement[];

const field = document.getElementById(SEARCH_FIELD_ID) as HTMLInputElement | null;
const searchBox = field && (field.closest(".reg-search") as HTMLElement | null);

if (field && searchBox) {
  const noMatch = searchBox.querySelector(".reg-none") as HTMLElement;

  const applySearch = () => {
    let found = 0;
    for (const card of all(REGISTRATION)) {
      const keys = { numbers: card.getAttribute(SEARCH_ATTRIBUTES.numbers) || "", names: card.getAttribute(SEARCH_ATTRIBUTES.names) || "" };
      card.hidden = !matchesSearch(keys, field.value);
      if (!card.hidden) found++;
    }
    for (const group of all(".reg-division, .reg-duration")) group.hidden = !group.querySelector(`${REGISTRATION}:not([hidden])`);
    // Only something typed can match nothing: on a page without Registrations, the empty field says nothing.
    noMatch.hidden = found > 0 || field.value.trim() === "";
  };

  searchBox.hidden = false;
  field.addEventListener("input", applySearch);
  field.addEventListener("keydown", (event) => {
    // "Esc" on older browsers.
    if (event.key !== "Escape" && event.key !== "Esc") return;
    event.preventDefault();
    field.value = "";
    applySearch();
  });
  // Coming back to the page, the browser may have kept what was typed.
  window.addEventListener("pageshow", applySearch);
  document.addEventListener(LIST_CHANGED_EVENT, applySearch);
  applySearch();
  // The field was hidden while the browser would have focused it.
  if (field.autofocus) field.focus();
}
